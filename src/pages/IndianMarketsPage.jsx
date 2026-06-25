import { useState, useEffect, useMemo, useCallback, useRef, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Header from '../components/Header';
import IndiaStockSearchWorker from '../workers/indiaStockSearch.worker.js?worker';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import IndiaMarkets from '../components/markets/IndiaMarkets';
import CustomSelect from '../components/CustomSelect';
import {
  addFavourite,
  removeFavourite,
  addWishlist,
  removeWishlist,
  getFavourites,
  getWishlist,
  itemKey,
  parseIndiaFavouriteName,
} from '../services/favouritesWishlistApi';
import '../styles/pages/Markets.css';
import '../styles/pages/IndiaSearchModal.css';
import { formatIndianOrderPairDisplay } from '../utils/helper';
import { indiaFuzzySymbolMatch } from '../utils/indiaPairResolve';
import { writeIndiaExchangeToSession, writeIndiaPairIdToSession } from '../services/indiaTicksSubscription';
import { tokenStorage } from '../utils/storage';
import { buildCdrtokenValue } from '../utils/authTokens';
import api from '../services/api';

const sortOptions = [
  { id: 'volume', label: 'Volume' },
  { id: 'price', label: 'Price' },
  { id: 'change', label: '24h Change' },
  { id: 'name', label: 'Name' },
];

const normalizeFavSymbol = (value) =>
  String(value || '').toUpperCase().trim().replace(/[/\-\s_.:]/g, '');

const normalizeMarketSymbol = (value) =>
  String(value || '').toUpperCase().trim().replace(/[/\-\s_.:]/g, '');

function findIndiaFavouriteEntry(list, { incomingPairId, normalizedTarget }) {
  const pairIdNeedle = String(incomingPairId || '').trim();
  return (list || []).find((entry) => {
    if (String(entry?.type || '').trim().toLowerCase() !== 'india') return false;
    const parsed = parseIndiaFavouriteName(entry?.name);
    const normStored = normalizeFavSymbol(parsed.symbol);
    if (pairIdNeedle && parsed.pairId && pairIdNeedle === String(parsed.pairId).trim()) {
      return true;
    }
    if (normStored === normalizedTarget) return true;
    return indiaFuzzySymbolMatch(normalizedTarget, normStored);
  }) || null;
}

function filterOutIndiaFavourite(list, { pairIdStr, normalizedTarget }) {
  return (list || []).filter((item) => {
    if (String(item?.type || '').trim().toLowerCase() !== 'india') return true;
    const parsed = parseIndiaFavouriteName(item?.name);
    if (pairIdStr && parsed.pairId && String(parsed.pairId).trim() === pairIdStr) {
      return false;
    }
    const normStored = normalizeFavSymbol(parsed.symbol);
    const nameMatches =
      normStored === normalizedTarget
      || indiaFuzzySymbolMatch(normalizedTarget, normStored);
    return !nameMatches;
  });
}

const SEARCH_TEXT_MIN_LEN = 1;
const MAX_OPTION_CHAINS = 40;
const MAX_STRIKES_PER_CHAIN = 120;
/** Cap rows fed into grouping / chain builder so UI stays smooth on huge hit sets */
const MAX_HITS_FOR_UI_AGG = 5000;
const MAX_CHAIN_SOURCE_ITEMS = 12000;
const SEARCH_DEBOUNCE_MS = 100;
const CLASSIC_GROUPS_PAGE = 80;
const FLAT_SEARCH_PAGE = 60;
function expiryKeyFromItem(item) {
  const e = item?.expirydate;
  if (e == null || String(e).trim() === '') return '—';
  return String(e).split(/[ T]/)[0];
}

function formatExpiryLabel(key) {
  if (key == null || key === '' || key === '—') return '—';
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(key);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatExpiryShort(key) {
  if (key == null || key === '' || key === '—') return '—';
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(key);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function parseIndiaSearchDisplay(symbol, pairname = '') {
  const raw = String(symbol || '').trim();
  const display = formatIndianOrderPairDisplay(raw) || raw;
  const parts = display.split(' · ').map((p) => p.trim()).filter(Boolean);
  const underlying = parts[0] || String(pairname || '').trim() || raw;
  const contractParts = parts.slice(1);
  return {
    underlying,
    contractLabel: contractParts.join(' · '),
    fullDisplay: display,
    rawCode: raw,
  };
}

/** Styled listbox for Indian search modal (native select option menus cannot be themed). */
function MarketsSearchCustomSelect({
  value,
  onChange,
  options,
  allValue = 'all',
  allLabel,
  withAll = true,
  disabled = false,
  menuTall = false,
  className = '',
  ariaLabel,
  placeholder,
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);
  const listId = useId();

  const items = useMemo(() => {
    //   if (!withAll) return options;
    //   return [{ value: allValue, label: allLabel }, ...options];
    // }, [withAll, allValue, allLabel, options]);

    let list = options;
    if (withAll) list = [{ value: allValue, label: allLabel }, ...options];
    if (searchable && searchText) {
      list = list.filter(o => String(o.label).toLowerCase().includes(searchText.toLowerCase()));
    }
    return list;
  }, [withAll, allValue, allLabel, options, searchable, searchText]);

  useEffect(() => {
    if (!open) {
      setSearchText('');
    }
  }, [open]);

  const selectedLabel = useMemo(() => {
    // const f = items.find((o) => String(o.value) === String(value));
    if (value === '') return placeholder || 'Select...';
    // We check against all options to get the correct label, not just the filtered `items`
    let fullList = options;
    if (withAll) fullList = [{ value: allValue, label: allLabel }, ...options];
    const f = fullList.find((o) => String(o.value) === String(value));
    return f ? f.label : String(value);
    // }, [items, value]);
  }, [withAll, allValue, allLabel, options, value, placeholder]);


  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const r = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const isInside = (root, node) => {
      if (!root || !node || !(node instanceof Node)) return false;
      return node === root || root.contains(node);
    };
    /** Scrollbar / shadow-DOM hits sometimes skip contains(target); composedPath fixes that. */
    const eventPathIncludes = (root, e) => {
      if (!root) return false;
      const path =
        typeof e.composedPath === 'function' ? e.composedPath() : [e.target].filter(Boolean);
      for (const n of path) {
        if (isInside(root, n)) return true;
      }
      return false;
    };
    /** Scrollbar drags sometimes omit the list from composedPath; hit-test the menu box. */
    const pointInsideEl = (el, e) => {
      if (!el || e.clientX == null || e.clientY == null) return false;
      const r = el.getBoundingClientRect();
      return (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      );
    };
    const onDoc = (e) => {
      if (eventPathIncludes(rootRef.current, e) || eventPathIncludes(menuRef.current, e)) return;
      if (pointInsideEl(menuRef.current, e)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => setOpen(false);
    const onScroll = (e) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target))) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const menuEl =
    open && menuPos ? (
      <ul
        ref={menuRef}
        id={listId}
        className={`marketsSearchCustomSelectMenu marketsSearchCustomSelectMenu--portal ${menuTall ? 'marketsSearchCustomSelectMenu--tall' : ''}`.trim()}
        role="listbox"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          /* Above .marketsSearchModalOverlay (10200) so the list is visible */
          zIndex: 11000,
        }}
      >
        {searchable && (
          <li style={{ padding: '0 6px 6px 6px', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 2, marginBottom: '4px', borderBottom: '1px solid var(--border-light)' }} role="none">
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              autoFocus
              style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px', padding: '8px 10px', transition: 'border-color 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--brand-primary, #ffd500)'; e.target.style.boxShadow = '0 0 0 2px rgba(255, 213, 0, 0.2)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.boxShadow = 'none'; }}
            />
          </li>
        )}

        {items.map((opt) => (
          <li key={`${String(opt.value)}-${opt.label}`} role="none">
            <button
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              className={`marketsSearchCustomSelectOption ${String(opt.value) === String(value) ? 'marketsSearchCustomSelectOption--active' : ''}`.trim()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-tertiary)' }}>No results found</li>
        )}
      </ul>
    ) : null;

  return (
    <div
      className={`marketsSearchCustomSelect ${open ? 'marketsSearchCustomSelect--open' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="marketsSearchCustomSelectTrigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="marketsSearchCustomSelectValue">{selectedLabel}</span>
        <span className="marketsSearchCustomSelectChevron" aria-hidden="true" />
      </button>
      {menuEl && typeof document !== 'undefined' ? createPortal(menuEl, document.body) : null}
    </div>
  );
}

function getStrikeNumber(item) {
  const n = Number(item?.strike);
  if (Number.isFinite(n) && n > 0) return n;
  const sym = String(item?.pairsymbol || '').toUpperCase();
  const m = sym.match(/(\d{3,})(CE|PE)$/);
  return m ? Number(m[1]) : null;
}

function getOptionSideFromItem(item) {
  const sym = String(item?.pairsymbol || '').toUpperCase();
  if (sym.endsWith('CE')) return 'CE';
  if (sym.endsWith('PE')) return 'PE';
  const inst = String(item?.instrumentType || '').toUpperCase();
  if (inst.includes('CALL') || inst.includes('CE')) return 'CE';
  if (inst.includes('PUT') || inst.includes('PE')) return 'PE';
  return null;
}

function isOptionLikeItem(item) {
  return getOptionSideFromItem(item) != null || /OPT/i.test(String(item?.instrumentType || ''));
}

function isFutureLikeItem(item) {
  const inst = String(item?.instrumentType || '').toUpperCase();
  if (inst.includes('FUT')) return true;
  const sym = String(item?.pairsymbol || '').toUpperCase();
  return /FUT/i.test(sym) && !isOptionLikeItem(item);
}

function matchesProductKindFilter(item, kind) {
  if (kind === 'all') return true;
  const opt = isOptionLikeItem(item);
  const fut = isFutureLikeItem(item);
  if (kind === 'options') return opt;
  if (kind === 'futures') return fut && !opt;
  if (kind === 'equity') return !opt && !fut;
  return true;
}

/** Worker bucket must match `matchesProductKindFilter` logic */
function productKindBucket(item) {
  if (isOptionLikeItem(item)) return 'options';
  if (isFutureLikeItem(item)) return 'futures';
  return 'equity';
}

function underlyingLabelFromItem(item) {
  const name = String(item?.pairname || '').trim();
  if (name) {
    const tok = name.split(/\s+/)[0].replace(/\s+/g, '');
    if (tok) return tok.replace(/(CE|PE)$/i, '').toUpperCase();
  }
  const sym = String(item?.pairsymbol || '').toUpperCase();
  if (!sym) return '—';
  const side = getOptionSideFromItem(item);
  if (!side) return sym;
  let base = sym.slice(0, -2);
  const strike = getStrikeNumber(item);
  if (strike != null) {
    const suf = String(Math.floor(strike));
    if (base.endsWith(suf)) base = base.slice(0, -suf.length);
  }
  return base.replace(/(\d+)$/, '').trim() || base || sym;
}

function buildOptionChainsFromItems(items, strikeSort) {
  const groups = new Map();
  for (const item of items) {
    if (!isOptionLikeItem(item)) continue;
    const side = getOptionSideFromItem(item);
    const strike = getStrikeNumber(item);
    if (!side || strike == null || strike <= 0) continue;
    const und = underlyingLabelFromItem(item);
    const expK = expiryKeyFromItem(item);
    const gk = `${und}__${expK}`;
    if (!groups.has(gk)) {
      groups.set(gk, {
        key: gk,
        underlying: und,
        expiryKey: expK,
        expiryLabel: formatExpiryLabel(expK),
        segment: item.segment,
        exchange: item.exchange,
        instrumentType: item.instrumentType,
        strikes: new Map(),
      });
    }
    const g = groups.get(gk);
    const row = g.strikes.get(strike) || { call: null, put: null };
    if (side === 'CE' && !row.call) row.call = item;
    if (side === 'PE' && !row.put) row.put = item;
    g.strikes.set(strike, row);
  }
  const chains = Array.from(groups.values()).map((g) => {
    let rows = [...g.strikes.entries()].map(([strike, sides]) => ({ strike, ...sides }));
    rows.sort((a, b) => (strikeSort === 'desc' ? b.strike - a.strike : a.strike - b.strike));
    const truncated = rows.length > MAX_STRIKES_PER_CHAIN;
    if (truncated) rows = rows.slice(0, MAX_STRIKES_PER_CHAIN);
    return { ...g, rows, truncated };
  });
  chains.sort((a, b) => a.underlying.localeCompare(b.underlying) || a.expiryKey.localeCompare(b.expiryKey));
  return chains.slice(0, MAX_OPTION_CHAINS);
}

const IndianMarketsPage = () => {
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
  // Show favorites list by default (no user click).
  const [loading, setLoading] = useState(false);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [favouritesList, setFavouritesList] = useState([]);
  const [watchlistList, setWatchlistList] = useState([]);
  const [togglingKey, setTogglingKey] = useState(null);
  const [type, setType] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [searchProductKind, setSearchProductKind] = useState('all');
  const [searchSegment, setSearchSegment] = useState('all');
  const [searchExchange, setSearchExchange] = useState('all');
  const [searchExpiry, setSearchExpiry] = useState('all');
  const [searchInstrumentType, setSearchInstrumentType] = useState('all');
  const [searchStrikeSort, setSearchStrikeSort] = useState('asc');
  const [searchViewMode, setSearchViewMode] = useState('chain');
  const [stockList, setStockList] = useState([]);
  const [stockListLoading, setStockListLoading] = useState(false);
  const [stockListLoaded, setStockListLoaded] = useState(false);

  const stockListRef = useRef(stockList);
  const stockListLoadedRef = useRef(stockListLoaded);
  const stockListLoadingRef = useRef(stockListLoading);
  stockListRef.current = stockList;
  stockListLoadedRef.current = stockListLoaded;
  stockListLoadingRef.current = stockListLoading;

  const [debouncedModalSearchQuery, setDebouncedModalSearchQuery] = useState('');
  const [workerIndexed, setWorkerIndexed] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);
  const [workerHitIndices, setWorkerHitIndices] = useState(null);
  const [lastSearchMs, setLastSearchMs] = useState(null);
  const [classicGroupLimit, setClassicGroupLimit] = useState(CLASSIC_GROUPS_PAGE);
  const [flatSearchLimit, setFlatSearchLimit] = useState(FLAT_SEARCH_PAGE);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [searchSelectedByKey, setSearchSelectedByKey] = useState({});
  const [bulkFavBusy, setBulkFavBusy] = useState(false);
  const workerRef = useRef(null);
  const searchSeqRef = useRef(0);

  // --- NEW INLINE FILTERS STATE ---
  const [instrumentsList, setInstrumentsList] = useState([]);
  const [filterSegment, setFilterSegment] = useState('');
  const [filterScript, setFilterScript] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');
  const [filterCePe, setFilterCePe] = useState('');
  const [filterStrike, setFilterStrike] = useState('');

  // Keeps track of which pairIds we already asked the backend to subscribe.
  // This ensures `/ws/subscribed` starts streaming ticks for ALL favorites/watchlist rows,
  // not only the one the user navigates to.
  const subscribedPairIdsRef = useRef(new Set());
  // PairIds actively being removed — blocks the sync effect from re-subscribing mid-unsubscribe.
  const unsubscribingPairIdsRef = useRef(new Set());
  // PairIds the user removed this session — sync effect must not re-subscribe until re-added.
  const removedPairIdsRef = useRef(new Set());

  const favoritesSet = useMemo(() => {
    const out = new Set();
    for (const { name, type } of favouritesList) {
      const rawType = String(type || '').trim().toLowerCase();
      if (rawType === 'india') {
        // Backend stores "pairSymbol_pairid". UI stars should match pairSymbol.
        const parsed = parseIndiaFavouriteName(name);
        const symbolOnly = parsed.symbol || '';
        if (!symbolOnly) continue;
        out.add(itemKey(symbolOnly, type));
        out.add(itemKey(normalizeFavSymbol(symbolOnly), type));
        if (parsed.pairId) {
          const pid = String(parsed.pairId).trim();
          out.add(itemKey(`${symbolOnly}_${pid}`, type));
          out.add(itemKey(`${normalizeFavSymbol(symbolOnly)}_${pid}`, type));
        }
      } else {
        out.add(itemKey(name, type));
      }
    }
    return out;
  }, [favouritesList]);

  const watchlistSet = useMemo(() => {
    const out = new Set();
    for (const { name, type } of watchlistList) {
      const rawType = String(type || '').trim().toLowerCase();
      if (rawType === 'india') {
        out.add(itemKey(name, type));
        out.add(itemKey(normalizeFavSymbol(name), type));
      } else {
        out.add(itemKey(name, type));
      }
    }
    return out;
  }, [watchlistList]);

  const indiaFavouritesCount = useMemo(
    () =>
      favouritesList.filter(
        ({ type }) => String(type || '').trim().toLowerCase() === 'india'
      ).length,
    [favouritesList]
  );

  const indiaFavoritePairIdsSet = useMemo(
    () =>
      new Set(
        favouritesList
          .filter(({ type }) => String(type || '').trim().toLowerCase() === 'india')
          .map(({ name }) => String(parseIndiaFavouriteName(name).pairId || '').trim())
          .filter(Boolean)
      ),
    [favouritesList]
  );

  const indiaFavoriteSymbolsSet = useMemo(
    () =>
      new Set(
        favouritesList
          .filter(({ type }) => String(type || '').trim().toLowerCase() === 'india')
          .map(({ name }) => normalizeFavSymbol(parseIndiaFavouriteName(name).symbol))
          .filter(Boolean)
      ),
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

  const fetchStockList = useCallback(async ({ force = false, silent = false } = {}) => {
    if ((stockListLoadedRef.current || stockListLoadingRef.current) && !force) {
      return stockListRef.current;
    }
    stockListLoadingRef.current = true;
    setStockListLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://192.168.0.109:3000/v1';
      const url = `${baseUrl.replace(/\/+$/, '')}/trading/stocklist`;
      const res = await fetch(url);
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];
      const normalizedList = list
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const pairsymbol = String(item.pairsymbol || '').trim();
          const pairname = String(item.pairname || '').trim();
          if (!pairsymbol && !pairname) return null;
          const exchange = String(item.exchange || '').trim();
          const segment = String(item.segment || '').trim();
          const instrumentType = String(item.instrumentType || item.instrumenttype || '').trim();
          const strike = String(item.strike || '').trim();
          const searchText = [
            pairsymbol,
            pairname,
            exchange,
            segment,
            instrumentType,
            strike,
          ]
            .join(' ')
            .toLowerCase();
          return {
            pairid: String(item.pairid || ''),
            pairsymbol,
            pairname,
            exchange,
            segment,
            instrumentType,
            lotsize: item.lotsize,
            strike: item.strike,
            expirydate: item.expirydate,
            isactive: item.isactive,
            searchText,
          };
        })
        .filter(Boolean);
      stockListRef.current = normalizedList;
      stockListLoadedRef.current = true;
      setStockList(normalizedList);
      setStockListLoaded(true);
      return normalizedList;
    } catch {
      stockListRef.current = [];
      stockListLoadedRef.current = true;
      setStockList([]);
      setStockListLoaded(true);
      if (!silent) {
        showError('Failed to load stock list');
      }
      return [];
    } finally {
      stockListLoadingRef.current = false;
      setStockListLoading(false);
    }
  }, [showError]);

  const [segmentOptions, setSegmentOptions] = useState([]);
  const [scriptOptions, setScriptOptions] = useState([]);
  const [expiryOptions, setExpiryOptions] = useState([]);
  const [cePeOptions, setCePeOptions] = useState([]);
  const [strikeOptions, setStrikeOptions] = useState([]);

  const [fetchingSegments, setFetchingSegments] = useState(true);
  const [fetchingScripts, setFetchingScripts] = useState(false);
  const [fetchingExpiries, setFetchingExpiries] = useState(false);
  const [fetchingCePes, setFetchingCePes] = useState(false);
  const [fetchingStrikes, setFetchingStrikes] = useState(false);

  // State to hold the final ID returned by the API
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(null);

  // Fetch Segments
  useEffect(() => {
    setFetchingSegments(true);
    api.get(`/trading/instruments?segment=&pairname=&expiry=&option_type=`)
      .then(res => {
        if (res?.status && Array.isArray(res.data)) {
          setSegmentOptions(res.data);
        }
      }).catch(console.error).finally(() => setFetchingSegments(false));
  }, []);


  // Fetch Scripts
  useEffect(() => {
    if (!filterSegment) {
      setScriptOptions([]);
      return;
    }
    setScriptOptions([]);
    setFetchingScripts(true);
    api.get(`/trading/instruments?segment=${filterSegment}&pairname=&expiry=&option_type=`)
      .then(res => {
        if (res?.status && Array.isArray(res.data)) {
          setScriptOptions(res.data);
        }
      }).catch(console.error).finally(() => setFetchingScripts(false));
  }, [filterSegment]);

  // Fetch Expiry
  useEffect(() => {
    if (!filterSegment || !filterScript) {
      setExpiryOptions([]);
      return;
    }
    setExpiryOptions([]);
    setFetchingExpiries(true);
    api.get(`/trading/instruments?segment=${filterSegment}&pairname=${filterScript}&expiry=&option_type=`)
      .then(res => {
        if (res?.status && Array.isArray(res.data)) {
          setExpiryOptions(res.data);
        }
      }).catch(console.error).finally(() => setFetchingExpiries(false));
  }, [filterSegment, filterScript]);

  // Fetch Option Type (CE/PE)
  useEffect(() => {
    if (!filterSegment || !filterScript || !filterExpiry) {
      setCePeOptions([]);
      return;
    }
    setCePeOptions([]);
    setFetchingCePes(true);
    api.get(`/trading/instruments?segment=${filterSegment}&pairname=${filterScript}&expiry=${filterExpiry}&option_type=`)
      .then(res => {
        if (res?.status && Array.isArray(res.data)) {
          setCePeOptions(res.data);
        }
      }).catch(console.error).finally(() => setFetchingCePes(false));
  }, [filterSegment, filterScript, filterExpiry]);

  // Fetch Strike
  useEffect(() => {
    if (!filterSegment || !filterScript || !filterExpiry) {
      setStrikeOptions([]);
      return;
    }
    setStrikeOptions([]);
    setFetchingStrikes(true);
    // If option_type is available, include it, otherwise leave it blank
    api.get(`/trading/instruments?segment=${filterSegment}&pairname=${filterScript}&expiry=${filterExpiry}&option_type=${filterCePe || ''}`)
      .then(res => {
        if (res?.status && Array.isArray(res.data)) {
          // If the previous level returned CE/PE, this call (with option_type set) should return strikes.
          // If the previous level returned strikes directly (e.g. FUT), this will just populate strikeOptions.
          setStrikeOptions(res.data);
        }
      }).catch(console.error).finally(() => setFetchingStrikes(false));
  }, [filterSegment, filterScript, filterExpiry, filterCePe]);

  // Fetch final ID when all required filters are selected
  useEffect(() => {
    if (!filterSegment || !filterScript || !filterExpiry) {
      setSelectedInstrumentId(null);
      return;
    }

    const headers = {};
    const token = tokenStorage.getToken();
    if (token) {
      headers['token'] = token;
    }

    const params = new URLSearchParams();
    params.append('segment', filterSegment);
    params.append('pairname', filterScript);
    params.append('expiry', filterExpiry);
    params.append('option_type', filterCePe || '');
    if (filterStrike) {
      params.append('strike', filterStrike);
    }

    api.get(`/trading/instruments?${params.toString()}`, { headers })
      .then(res => {
        // The API returns { code: 200, status: true, id: "..." }
        if (res?.status && res?.id) {
          setSelectedInstrumentId(res.id);
        } else if (res?.status && res?.data?.id) {
          setSelectedInstrumentId(res.data.id);
        } else if (res?.status && res?.data && !Array.isArray(res.data) && typeof res.data === 'string') {
          // Fallback if id is returned directly in data
          setSelectedInstrumentId(res.data);
        } else {
          setSelectedInstrumentId(null);
        }
      })
      .catch(console.error);
  }, [filterSegment, filterScript, filterExpiry, filterCePe, filterStrike]);

  // handleInlineAdd moved to avoid ReferenceError

  const openSearchModal = useCallback(() => {
    setIsSearchModalOpen(true);
    setModalSearchQuery('');
    setDebouncedModalSearchQuery('');
    setClassicGroupLimit(CLASSIC_GROUPS_PAGE);
    setFlatSearchLimit(FLAT_SEARCH_PAGE);
    setShowSearchFilters(false);
    setSearchProductKind('all');
    setSearchSegment('all');
    setSearchExchange('all');
    setSearchExpiry('all');
    setSearchInstrumentType('all');
    setSearchStrikeSort('asc');
    setSearchViewMode('chain');
    fetchStockList({ silent: true });
  }, [fetchStockList]);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalOpen(false);
    setModalSearchQuery('');
    setDebouncedModalSearchQuery('');
    setSearchProductKind('all');
    setSearchSegment('all');
    setSearchExchange('all');
    setSearchExpiry('all');
    setSearchInstrumentType('all');
    setSearchStrikeSort('asc');
    setSearchViewMode('chain');
    setClassicGroupLimit(CLASSIC_GROUPS_PAGE);
    setFlatSearchLimit(FLAT_SEARCH_PAGE);
    setShowSearchFilters(false);
    setWorkerHitIndices(null);
    setLastSearchMs(null);
    setSearchSelectedByKey({});
  }, []);

  useEffect(() => {
    if (!isSearchModalOpen) return undefined;
    setDebouncedModalSearchQuery(modalSearchQuery);
    const t = window.setTimeout(() => {
      setDebouncedModalSearchQuery(modalSearchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [modalSearchQuery, isSearchModalOpen]);

  const workerFilters = useMemo(
    () => ({
      productKind: searchProductKind,
      segment: searchSegment,
      exchange: searchExchange,
      expiry: searchExpiry,
      instrumentType: searchInstrumentType,
    }),
    [searchProductKind, searchSegment, searchExchange, searchExpiry, searchInstrumentType]
  );

  const compactSearchRows = useMemo(
    () =>
      stockList.map((item) => ({
        t: String(item.searchText || '').toLowerCase(),
        seg: String(item.segment || '').trim(),
        ex: String(item.exchange || '').trim(),
        exp: (() => {
          const ek = expiryKeyFromItem(item);
          return ek === '—' ? '' : ek;
        })(),
        inst: String(item.instrumentType || '').trim(),
        p: String(item.pairid || '').trim(),
        k: productKindBucket(item),
      })),
    [stockList]
  );

  useEffect(() => {
    let w;
    try {
      w = new IndiaStockSearchWorker();
    } catch {
      setWorkerFailed(true);
      return undefined;
    }
    workerRef.current = w;
    w.onmessage = (ev) => {
      const data = ev.data || {};
      if (data.type === 'READY') {
        setWorkerIndexed(true);
        setWorkerHitIndices(null);
        return;
      }
      if (data.type === 'RESULT') {
        if (data.seq !== searchSeqRef.current) return;
        setWorkerHitIndices(Array.isArray(data.indices) ? data.indices : []);
        setLastSearchMs(typeof data.ms === 'number' ? data.ms : null);
      }
    };
    return () => {
      w.terminate();
      workerRef.current = null;
      setWorkerIndexed(false);
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w || workerFailed || compactSearchRows.length === 0) return;
    w.postMessage({ type: 'REINDEX', payload: { rows: compactSearchRows } });
  }, [compactSearchRows, workerFailed]);

  const fireWorkerSearch = useCallback(() => {
    const w = workerRef.current;
    if (!w || workerFailed || !workerIndexed) return;
    searchSeqRef.current += 1;
    const seq = searchSeqRef.current;
    w.postMessage({
      type: 'SEARCH',
      payload: {
        query: debouncedModalSearchQuery,
        filters: workerFilters,
        seq,
      },
    });
  }, [debouncedModalSearchQuery, workerFilters, workerFailed, workerIndexed]);

  useEffect(() => {
    if (!isSearchModalOpen || workerFailed || !workerIndexed) return;
    fireWorkerSearch();
  }, [isSearchModalOpen, workerFailed, workerIndexed, fireWorkerSearch]);

  const searchFilterOptions = useMemo(() => {
    const segments = new Set();
    const exchanges = new Set();
    const expiries = new Set();
    const inst = new Set();
    for (const s of stockList) {
      if (!s) continue;
      if (s.segment) segments.add(String(s.segment).trim());
      if (s.exchange) exchanges.add(String(s.exchange).trim());
      const ek = expiryKeyFromItem(s);
      if (ek && ek !== '—') expiries.add(ek);
      if (s.instrumentType) inst.add(String(s.instrumentType).trim());
    }
    return {
      segments: [...segments].sort((a, b) => a.localeCompare(b)),
      exchanges: [...exchanges].sort((a, b) => a.localeCompare(b)),
      expiries: [...expiries].sort((a, b) => a.localeCompare(b)),
      instrumentTypes: [...inst].sort((a, b) => a.localeCompare(b)),
    };
  }, [stockList]);

  const modalSegmentOptions = useMemo(
    () => searchFilterOptions.segments.map((s) => ({ value: s, label: s })),
    [searchFilterOptions.segments]
  );
  const modalExchangeOptions = useMemo(
    () => searchFilterOptions.exchanges.map((s) => ({ value: s, label: s })),
    [searchFilterOptions.exchanges]
  );
  const modalExpiryOptions = useMemo(
    () =>
      searchFilterOptions.expiries.map((s) => ({
        value: s,
        label: formatExpiryLabel(s),
      })),
    [searchFilterOptions.expiries]
  );
  const modalInstrumentOptions = useMemo(
    () => searchFilterOptions.instrumentTypes.map((s) => ({ value: s, label: s })),
    [searchFilterOptions.instrumentTypes]
  );
  const modalStrikeSortOptions = useMemo(
    () => [
      { value: 'asc', label: 'Strike low → high' },
      { value: 'desc', label: 'Strike high → low' },
    ],
    []
  );

  const syncFilteredStockList = useMemo(() => {
    const q = debouncedModalSearchQuery.trim().toLowerCase();
    const hasActiveFilters =
      searchProductKind !== 'all' ||
      searchSegment !== 'all' ||
      searchExchange !== 'all' ||
      searchExpiry !== 'all' ||
      searchInstrumentType !== 'all';
    if (q.length < SEARCH_TEXT_MIN_LEN && !hasActiveFilters) return [];
    const pool =
      q.length >= SEARCH_TEXT_MIN_LEN
        ? stockList.filter((item) => {
          if (!item) return false;
          const searchText = String(item.searchText || '').toLowerCase();
          return searchText && searchText.includes(q);
        })
        : [...stockList];
    return pool.filter((item) => {
      if (!item) return false;
      if (!matchesProductKindFilter(item, searchProductKind)) return false;
      if (searchSegment !== 'all' && String(item.segment || '').trim() !== searchSegment) return false;
      if (searchExchange !== 'all' && String(item.exchange || '').trim() !== searchExchange) return false;
      if (searchExpiry !== 'all' && expiryKeyFromItem(item) !== searchExpiry) return false;
      if (searchInstrumentType !== 'all' && String(item.instrumentType || '').trim() !== searchInstrumentType) {
        return false;
      }
      return true;
    });
  }, [
    debouncedModalSearchQuery,
    stockList,
    searchProductKind,
    searchSegment,
    searchExchange,
    searchExpiry,
    searchInstrumentType,
  ]);

  const useWorkerHits = workerIndexed && !workerFailed && workerHitIndices !== null;

  const filteredStockList = useMemo(() => {
    if (useWorkerHits) {
      const out = [];
      for (let i = 0; i < workerHitIndices.length; i += 1) {
        const idx = workerHitIndices[i];
        const row = stockList[idx];
        if (row) out.push(row);
      }
      return out;
    }
    return syncFilteredStockList;
  }, [useWorkerHits, workerHitIndices, stockList, syncFilteredStockList]);

  const hitsForAggregation = useMemo(() => {
    if (filteredStockList.length <= MAX_HITS_FOR_UI_AGG) return filteredStockList;
    return filteredStockList.slice(0, MAX_HITS_FOR_UI_AGG);
  }, [filteredStockList]);

  const totalMatchCount = filteredStockList.length;
  const isHitSetTruncated = totalMatchCount > MAX_HITS_FOR_UI_AGG;

  const visibleFlatSearchResults = useMemo(
    () => filteredStockList.slice(0, flatSearchLimit),
    [filteredStockList, flatSearchLimit]
  );
  const hasMoreFlatResults = filteredStockList.length > flatSearchLimit;

  const optionChains = useMemo(
    () =>
      buildOptionChainsFromItems(
        hitsForAggregation.slice(0, MAX_CHAIN_SOURCE_ITEMS),
        searchStrikeSort
      ),
    [hitsForAggregation, searchStrikeSort]
  );

  const groupedSearchResults = useMemo(() => {
    if (!hitsForAggregation || hitsForAggregation.length === 0) return [];

    const groups = new Map();

    const classifySide = (item) => {
      const rawSymbol = String(item?.pairsymbol || item?.pairname || '').toUpperCase().trim();
      let side = 'single';
      let root = rawSymbol;
      if (rawSymbol.endsWith('CE')) {
        side = 'call';
        root = rawSymbol.slice(0, -2);
      } else if (rawSymbol.endsWith('PE')) {
        side = 'put';
        root = rawSymbol.slice(0, -2);
      }
      return { side, root, rawSymbol };
    };

    hitsForAggregation.forEach((item) => {
      const { side, root } = classifySide(item);
      const key = root || String(item.pairid || item.pairsymbol || item.pairname || Math.random());
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          root,
          baseLabel: item.pairname || item.pairsymbol || root,
          call: null,
          put: null,
        };
        groups.set(key, group);
      }
      if (side === 'call') {
        if (!group.call) group.call = item;
      } else if (side === 'put') {
        if (!group.put) group.put = item;
      } else {
        if (!group.call) group.call = item;
      }
    });

    return Array.from(groups.values());
  }, [hitsForAggregation]);

  const groupedSearchResultsVisible = useMemo(
    () => groupedSearchResults.slice(0, classicGroupLimit),
    [groupedSearchResults, classicGroupLimit]
  );

  const hasMoreClassicGroups = groupedSearchResults.length > classicGroupLimit;

  const handleSelectStock = useCallback((item) => {
    const symbol = String(item?.pairsymbol || item?.pairname || '').trim();
    setSearchQuery(symbol);
    closeSearchModal();
  }, [closeSearchModal]);

  const resolvePairIdForSymbol = useCallback(
    async (symbol) => {
      const raw = String(symbol || '').trim();
      if (!raw) return null;

      const tryTargets = [];
      tryTargets.push(normalizeMarketSymbol(raw));
      // If symbol is like "MCX:GOLD26APR" then backend stocklist pairsymbol is usually "GOLD26APR"
      if (raw.includes(':')) {
        const afterColon = raw.split(':').slice(1).join(':').trim();
        if (afterColon) tryTargets.push(normalizeMarketSymbol(afterColon));
      }
      const targets = Array.from(new Set(tryTargets)).filter(Boolean);
      if (targets.length === 0) return null;

      const findPairId = (list) => {
        for (const item of list || []) {
          const pairSymbol = normalizeMarketSymbol(item?.pairsymbol);
          if (pairSymbol && targets.includes(pairSymbol)) {
            return String(item?.pairid || '').trim() || null;
          }
        }
        return null;
      };

      let pairId = findPairId(stockListRef.current);
      if (pairId) return pairId;

      // Avoid refetch loops on favourite/watchlist updates:
      // if stock list is already loaded and still no match, treat as unresolved.
      if (stockListLoadedRef.current) return null;

      const latestStockList = await fetchStockList({ silent: true });
      pairId = findPairId(latestStockList);
      return pairId;
    },
    [fetchStockList]
  );

  const callSubscriptionsApi = useCallback(async (endpoint, pairIds) => {
    const symbols = (Array.isArray(pairIds) ? pairIds : [pairIds])
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    const uniqueSymbols = Array.from(new Set(symbols));
    if (uniqueSymbols.length === 0) {
      throw new Error('Missing pair id(s)');
    }
    const token = tokenStorage.getToken();
    if (!token) {
      throw new Error('Please login to subscribe to market data.');
    }

    const baseUrl = import.meta.env.VITE_TICKS_BACKEND_URL;
    const url = `${baseUrl.replace(/\/+$/, '')}${endpoint}`;

    try {
      setLoading(true);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols: uniqueSymbols }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status === false) {
        throw new Error(data?.message || `Failed request: ${endpoint}`);
      }
      return data;
    } catch (err) {
      console.error('Subscriptions API Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pairIdFromStockItem = useCallback((item) => String(item?.pairid || '').trim(), []);

  const symbolFromStockItem = useCallback(
    (item) => String(item?.pairsymbol || item?.pairname || '').trim(),
    []
  );

  const isStockItemFavourite = useCallback(
    (item) => {
      const pairId = pairIdFromStockItem(item);
      if (pairId && indiaFavoritePairIdsSet.has(pairId)) return true;
      const symbol = symbolFromStockItem(item);
      return symbol ? indiaFavoriteSymbolsSet.has(normalizeFavSymbol(symbol)) : false;
    },
    [pairIdFromStockItem, symbolFromStockItem, indiaFavoritePairIdsSet, indiaFavoriteSymbolsSet]
  );

  const searchItemSelectKey = useCallback(
    (item) => {
      const pairId = pairIdFromStockItem(item);
      if (pairId) return `id:${pairId}`;
      const symbol = symbolFromStockItem(item);
      return symbol ? `sym:${normalizeFavSymbol(symbol)}` : '';
    },
    [pairIdFromStockItem, symbolFromStockItem]
  );

  const searchSelectionCount = useMemo(
    () => Object.keys(searchSelectedByKey).length,
    [searchSelectedByKey]
  );

  const toggleSearchItemSelected = useCallback(
    (item, checked) => {
      const key = searchItemSelectKey(item);
      if (!key) return;
      setSearchSelectedByKey((prev) => {
        const next = { ...prev };
        if (checked) next[key] = item;
        else delete next[key];
        return next;
      });
    },
    [searchItemSelectKey]
  );

  // Ensure existing favorites/watchlist are actually subscribed for live ticks.
  // Without this, UI may show items, but only the pair navigated to (Dashboard /ws/ticks/{pairId})
  // will have live price.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const run = async () => {
      const collectIndiaPairIds = (list) => {
        const outKnown = new Set();
        for (const item of list || []) {
          const rawType = String(item?.type || '').trim().toLowerCase();
          if (rawType !== 'india') continue;
          const name = String(item?.name || '').trim();
          if (!name) continue;
          const parsed = parseIndiaFavouriteName(name);
          if (parsed?.pairId) outKnown.add(String(parsed.pairId).trim());
        }
        return outKnown;
      };

      const currentKnownPairIds = new Set([
        ...collectIndiaPairIds(favouritesList),
        ...collectIndiaPairIds(watchlistList),
      ]);

      // Allow re-subscribe if user removed+added something again.
      subscribedPairIdsRef.current.forEach((pid) => {
        if (!currentKnownPairIds.has(pid)) subscribedPairIdsRef.current.delete(pid);
      });

      const toResolve = [];
      const toSubscribe = new Set(currentKnownPairIds);

      // If pairId isn't in stored name, resolve it from stock list.
      const collectMissing = (list) => {
        for (const item of list || []) {
          const rawType = String(item?.type || '').trim().toLowerCase();
          if (rawType !== 'india') continue;
          const name = String(item?.name || '').trim();
          if (!name) continue;
          const parsed = parseIndiaFavouriteName(name);
          if (!parsed) continue;
          if (parsed.pairId) continue;
          if (parsed.symbol) toResolve.push(parsed.symbol);
        }
      };

      collectMissing(favouritesList);
      collectMissing(watchlistList);

      /*
      for (const sym of toResolve) {
        if (cancelled) return;
        const pairId = await resolvePairIdForSymbol(sym);
        if (pairId) toSubscribe.add(String(pairId).trim());
      }
      */

      const resolvedMap = new Map();
      for (const sym of toResolve) {
        if (cancelled) return;
        const pairId = await resolvePairIdForSymbol(sym);
        if (pairId) {
          toSubscribe.add(String(pairId).trim());
          resolvedMap.set(sym, String(pairId).trim());
        }
      }

      if (resolvedMap.size > 0) {
        setFavouritesList((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (String(item?.type || '').trim().toLowerCase() !== 'india') return item;
            const parsed = parseIndiaFavouriteName(item.name);
            if (parsed.pairId) return item;
            const newPairId = resolvedMap.get(parsed.symbol);
            if (newPairId) {
              changed = true;
              return { ...item, name: `${parsed.symbol}_${newPairId}` };
            }
            return item;
          });
          return changed ? next : prev;
        });
        setWatchlistList((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (String(item?.type || '').trim().toLowerCase() !== 'india') return item;
            const parsed = parseIndiaFavouriteName(item.name);
            if (parsed.pairId) return item;
            const newPairId = resolvedMap.get(parsed.symbol);
            if (newPairId) {
              changed = true;
              return { ...item, name: `${parsed.symbol}_${newPairId}` };
            }
            return item;
          });
          return changed ? next : prev;
        });
      }

      const pendingSubscribe = [...toSubscribe].filter(
        (pairId) =>
          pairId
          && !subscribedPairIdsRef.current.has(pairId)
          && !unsubscribingPairIdsRef.current.has(pairId)
          && !removedPairIdsRef.current.has(pairId)
      );
      if (pendingSubscribe.length > 0) {
        if (cancelled) return;
        const res = await callSubscriptionsApi('/subscriptions/subscribe', pendingSubscribe);
        if (res) {
          pendingSubscribe.forEach((pairId) => subscribedPairIdsRef.current.add(pairId));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, favouritesList, watchlistList, resolvePairIdForSymbol, callSubscriptionsApi]);

  const toggleFavorite = useCallback(
    async (name, type = 'india', explicitAction = null, additionalData = {}) => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'india').trim();
      const isIndiaType = trimmedType.toLowerCase() === 'india';
      if (!trimmedName) return;
      if (!isAuthenticated) {
        showError('Please login to add favorites.');
        return;
      }
      const key = itemKey(trimmedName, trimmedType);
      if (togglingKey) return;
      setType(trimmedType);
      setTogglingKey(key);
      try {
        const parsedIncoming = parseIndiaFavouriteName(trimmedName);
        const symbolTarget = parsedIncoming.symbol || trimmedName;
        const incomingPairId = String(parsedIncoming.pairId || '').trim();
        const normalizedTarget = normalizeFavSymbol(symbolTarget);

        const existingIndiaFavorite = isIndiaType
          ? findIndiaFavouriteEntry(favouritesList, { incomingPairId, normalizedTarget })
          : null;

        const isFav = isIndiaType
          ? Boolean(existingIndiaFavorite)
          : favoritesSet.has(key);

        if (explicitAction === 'add' && isFav) {
          showSuccess('Already in your list');
          return;
        }

        if (isFav) {
          if (isIndiaType) {
            const storedName = String(existingIndiaFavorite?.name || '').trim();
            const parsedStored = storedName ? parseIndiaFavouriteName(storedName) : { symbol: '', pairId: '' };

            const symbolForUnsubscribe = parsedStored.symbol || symbolTarget;
            const pairId =
              parsedStored.pairId
              || incomingPairId
              || (await resolvePairIdForSymbol(symbolForUnsubscribe));

            if (!pairId) {
              throw new Error('Pair id not found for unsubscribe');
            }

            const pairIdStr = String(pairId).trim();
            removedPairIdsRef.current.add(pairIdStr);
            unsubscribingPairIdsRef.current.add(pairIdStr);

            setFavouritesList((prev) =>
              filterOutIndiaFavourite(prev, { pairIdStr, normalizedTarget })
            );

            try {
              await callSubscriptionsApi('/subscriptions/unsubscribe', [pairIdStr]);
              await removeFavourite(
                { id: pairIdStr, name: symbolForUnsubscribe },
                trimmedType
              );
            } catch (removeErr) {
              removedPairIdsRef.current.delete(pairIdStr);
              await fetchFavWatch();
              throw removeErr;
            } finally {
              unsubscribingPairIdsRef.current.delete(pairIdStr);
            }
          } else {
            await removeFavourite(trimmedName, trimmedType);
            setFavouritesList((prev) => prev.filter((i) => itemKey(i.name, i.type) !== key));
          }
          showSuccess('Removed from script');
        } else {
          if (isIndiaType) {
            const symbolForAdd = symbolTarget;
            const pairId = incomingPairId || (await resolvePairIdForSymbol(symbolForAdd));
            if (!pairId) {
              throw new Error('Pair id not found for subscribe');
            }
            const pairIdStr = String(pairId).trim();
            removedPairIdsRef.current.delete(pairIdStr);
            await callSubscriptionsApi('/subscriptions/subscribe', [pairIdStr]);
            subscribedPairIdsRef.current.add(pairIdStr);
            const apiFavoriteName = `${symbolForAdd}_${pairIdStr}`;
            await addFavourite({ id: pairIdStr, name: symbolForAdd }, trimmedType);
            setFavouritesList((prev) => [...prev, { name: apiFavoriteName, type: trimmedType, ...additionalData }]);
          } else {
            await addFavourite(trimmedName, trimmedType);
            setFavouritesList((prev) => [...prev, { name: trimmedName, type: trimmedType, ...additionalData }]);
          }
          showSuccess('Added to script');
        }
      } catch (e) {
        showError(e?.message || e?.data?.message || 'Failed to update favorite');
      } finally {
        setTogglingKey(null);
      }
    },
    [
      isAuthenticated,
      favoritesSet,
      togglingKey,
      showSuccess,
      showError,
      resolvePairIdForSymbol,
      callSubscriptionsApi,
      favouritesList,
      fetchFavWatch,
    ]
  );

  const bulkToggleSearchFavorites = useCallback(
    async (action) => {
      const selectedItems = Object.values(searchSelectedByKey);
      if (selectedItems.length === 0) return;
      if (!isAuthenticated) {
        showError('Please login to update favorites.');
        return;
      }
      if (bulkFavBusy || togglingKey) return;

      setBulkFavBusy(true);
      try {
        if (action === 'add') {
          const toAdd = [];
          for (const item of selectedItems) {
            const symbol = symbolFromStockItem(item);
            if (!symbol) continue;
            if (indiaFavoriteSymbolsSet.has(normalizeFavSymbol(symbol))) continue;

            let pairId = pairIdFromStockItem(item);
            if (!pairId) {
              pairId = await resolvePairIdForSymbol(symbol);
            }
            if (!pairId) continue;
            toAdd.push({ symbol, pairId: String(pairId).trim() });
          }

          if (toAdd.length === 0) {
            showError('Selected items are already in your list or pair id was not found.');
            return;
          }

          const pairIds = toAdd.map((entry) => entry.pairId);
          pairIds.forEach((pairId) => removedPairIdsRef.current.delete(pairId));
          await callSubscriptionsApi('/subscriptions/subscribe', pairIds);
          pairIds.forEach((pairId) => subscribedPairIdsRef.current.add(pairId));

          await addFavourite(
            toAdd.map(({ symbol, pairId }) => ({ id: pairId, name: symbol })),
            'india'
          );
          const addedEntries = toAdd.map(({ symbol, pairId }) => ({
            name: `${symbol}_${pairId}`,
            type: 'india',
          }));

          setFavouritesList((prev) => {
            const next = [...prev];
            for (const entry of addedEntries) {
              const exists = next.some(
                (i) =>
                  String(i?.type || '').trim().toLowerCase() === 'india' &&
                  String(i?.name || '').trim() === String(entry.name).trim()
              );
              if (!exists) next.push(entry);
            }
            return next;
          });
          showSuccess(
            `Added ${addedEntries.length} script${addedEntries.length === 1 ? '' : 's'} to your list`
          );
        } else {
          const toRemove = [];
          for (const item of selectedItems) {
            const symbol = symbolFromStockItem(item);
            if (!symbol) continue;
            const normalizedTarget = normalizeFavSymbol(symbol);
            const itemPairId = String(pairIdFromStockItem(item) || '').trim();
            const existingIndiaFavorite = findIndiaFavouriteEntry(favouritesList, {
              incomingPairId: itemPairId,
              normalizedTarget,
            });
            if (!existingIndiaFavorite) continue;

            const storedName = String(existingIndiaFavorite?.name || '').trim();
            const parsedStored = storedName
              ? parseIndiaFavouriteName(storedName)
              : { symbol: '', pairId: '' };
            const symbolForUnsubscribe = parsedStored.symbol || symbol;
            let pairId =
              parsedStored.pairId || itemPairId || (await resolvePairIdForSymbol(symbolForUnsubscribe));
            pairId = String(pairId || '').trim();
            if (!pairId) continue;

            toRemove.push({
              symbol: symbolForUnsubscribe,
              pairId,
              normalizedTarget,
            });
          }

          if (toRemove.length === 0) {
            showError('None of the selected items are in your list.');
            return;
          }

          const pairIds = toRemove.map((entry) => entry.pairId);
          pairIds.forEach((pid) => {
            removedPairIdsRef.current.add(pid);
            unsubscribingPairIdsRef.current.add(pid);
          });

          setFavouritesList((prev) =>
            toRemove.reduce(
              (list, { pairId, normalizedTarget }) =>
                filterOutIndiaFavourite(list, { pairIdStr: pairId, normalizedTarget }),
              prev
            )
          );

          try {
            await callSubscriptionsApi('/subscriptions/unsubscribe', pairIds);
            await removeFavourite(
              toRemove.map(({ symbol, pairId }) => ({ id: pairId, name: symbol })),
              'india'
            );
          } catch (removeErr) {
            pairIds.forEach((pid) => removedPairIdsRef.current.delete(pid));
            await fetchFavWatch();
            throw removeErr;
          } finally {
            pairIds.forEach((pid) => unsubscribingPairIdsRef.current.delete(pid));
          }

          showSuccess(
            `Removed ${toRemove.length} script${toRemove.length === 1 ? '' : 's'} from your list`
          );
        }
        setSearchSelectedByKey({});
      } catch (e) {
        showError(e?.message || e?.data?.message || 'Failed to update favorites');
      } finally {
        setBulkFavBusy(false);
      }
    },
    [
      searchSelectedByKey,
      isAuthenticated,
      bulkFavBusy,
      togglingKey,
      symbolFromStockItem,
      pairIdFromStockItem,
      indiaFavoriteSymbolsSet,
      resolvePairIdForSymbol,
      callSubscriptionsApi,
      favouritesList,
      showSuccess,
      showError,
      fetchFavWatch,
    ]
  );

  const toggleWatchlist = useCallback(
    async (name, type = 'india') => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'india').trim();
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

  const handleModalToggleFavorite = useCallback(
    async (item) => {
      const symbol = symbolFromStockItem(item);
      const pairId = pairIdFromStockItem(item);
      if (!symbol) return;
      const toggleName = pairId ? `${symbol}_${pairId}` : symbol;
      await toggleFavorite(toggleName, 'india');
    },
    [toggleFavorite, symbolFromStockItem, pairIdFromStockItem]
  );

  useEffect(() => {
    if (!isSearchModalOpen) return undefined;
    setFlatSearchLimit(FLAT_SEARCH_PAGE);
  }, [
    debouncedModalSearchQuery,
    searchProductKind,
    searchSegment,
    searchExchange,
    searchExpiry,
    searchInstrumentType,
    isSearchModalOpen,
  ]);

  useEffect(() => {
    if (!isSearchModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeSearchModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchModalOpen, closeSearchModal]);

  const getStockFavToggleKey = useCallback(
    (item) => {
      const symbol = symbolFromStockItem(item);
      const pairId = pairIdFromStockItem(item);
      if (!symbol) return '';
      return pairId ? itemKey(`${symbol}_${pairId}`, 'india') : itemKey(symbol, 'india');
    },
    [symbolFromStockItem, pairIdFromStockItem]
  );

  const renderSimpleSearchRow = useCallback(
    (item) => {
      const symbol = symbolFromStockItem(item);
      const pairId = pairIdFromStockItem(item);
      const favToggleKey = getStockFavToggleKey(item);
      const isTogglingThis = togglingKey === favToggleKey;
      const isFav = isStockItemFavourite(item);
      const expiryKey = expiryKeyFromItem(item);
      const expiryShort = formatExpiryShort(expiryKey);
      const { underlying, contractLabel, rawCode } = parseIndiaSearchDisplay(symbol, item?.pairname);
      const inst = String(item?.instrumentType || '').trim().toUpperCase()
        || (symbol.endsWith('FUT') ? 'FUT' : symbol.endsWith('CE') ? 'CE' : symbol.endsWith('PE') ? 'PE' : '—');
      const strike = Number(item?.strike);
      const showStrike = Number.isFinite(strike) && strike > 0;
      const exchange = String(item?.exchange || '').trim();

      return (
        <div
          key={pairId || symbol}
          className={`indiaSearchRow ${isFav ? 'indiaSearchRow--fav' : ''}`}
        >
          <button
            type="button"
            className="indiaSearchRowMain"
            onClick={() => handleSelectStock(item)}
          >
            <div className="indiaSearchRowSymbolCol">
              <div className="indiaSearchRowTitleLine">
                {exchange ? (
                  <span className="indiaSearchRowExchangePill">{exchange}</span>
                ) : null}
                <span className="indiaSearchRowUnderlying">{underlying}</span>
                {contractLabel ? (
                  <span className="indiaSearchRowContract">{contractLabel}</span>
                ) : null}
              </div>
              <span className="indiaSearchRowRawCode" title={rawCode}>{rawCode}</span>
            </div>
            <div className="indiaSearchRowMetaCol">
              <span className="indiaSearchRowExpiry">{expiryShort}</span>
              {showStrike ? (
                <span className="indiaSearchRowStrike">Strike {strike.toLocaleString('en-IN')}</span>
              ) : null}
            </div>
            <span className={`indiaSearchRowType indiaSearchRowType--${inst.toLowerCase()}`}>{inst}</span>
          </button>
          <button
            type="button"
            className={isFav ? 'indiaSearchRowAction indiaSearchRowAction--remove' : 'indiaSearchRowAction indiaSearchRowAction--add'}
            onClick={(e) => {
              e.stopPropagation();
              handleModalToggleFavorite(item);
            }}
            disabled={isTogglingThis || bulkFavBusy}
            aria-busy={isTogglingThis}
            aria-label={isFav ? 'Remove from list' : 'Add to list'}
          >
            {isTogglingThis ? (
              <span className="marketsSearchModalBtnSpinner" aria-hidden="true" />
            ) : isFav ? (
              'Remove'
            ) : (
              'Add'
            )}
          </button>
        </div>
      );
    },
    [
      symbolFromStockItem,
      pairIdFromStockItem,
      getStockFavToggleKey,
      togglingKey,
      isStockItemFavourite,
      handleSelectStock,
      handleModalToggleFavorite,
      bulkFavBusy,
    ]
  );

  const handleMarketClick = useCallback(
    async (marketId, marketType, explicitPairId = '', explicitExchange = '') => {
      const params = new URLSearchParams();

      if (marketId) params.set('market', String(marketId));
      if (marketType) params.set('type', String(marketType));

      if (String(marketType || '').trim().toLowerCase() === 'india') {
        let pairId = String(explicitPairId || '').trim();
        if (!pairId) {
          pairId = await resolvePairIdForSymbol(marketId);
        }
        const exchange = String(explicitExchange || '').trim();
        if (exchange) {
          writeIndiaExchangeToSession(marketId, exchange);
        }
        if (pairId) {
          params.set('pairid', String(pairId));
          writeIndiaPairIdToSession(marketId, pairId);
        }
      }

      const targetPath = `/dashboard?${params.toString()}`;
      window.location.href = targetPath;
    },
    [resolvePairIdForSymbol]
  );

  const handleInlineAdd = useCallback(async () => {
    if (!filterSegment && !filterScript) {
      showError('Please select a segment or script');
      return;
    }

    if (!selectedInstrumentId) {
      showError('No instrument ID found for the selected options.');
      return;
    }

    try {
      const symbol = String(filterScript || '').toUpperCase();
      const toggleName = `${symbol}_${selectedInstrumentId}`;
      await toggleFavorite(toggleName, 'india', 'add', { segment: filterSegment });

      setFilterSegment('');
      setFilterScript('');
      setFilterExpiry('');
      setFilterCePe('');
      setFilterStrike('');
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      showError('Failed to add instrument to list');
    }
  }, [filterSegment, filterScript, selectedInstrumentId, toggleFavorite, showError]);

  const hasAdvancedFilters =
    searchProductKind !== 'all' ||
    searchSegment !== 'all' ||
    searchExchange !== 'all' ||
    searchExpiry !== 'all' ||
    searchInstrumentType !== 'all';
  const searchInputReady =
    modalSearchQuery.trim().length >= SEARCH_TEXT_MIN_LEN || hasAdvancedFilters;
  const showChainView = searchViewMode === 'chain' && optionChains.length > 0;

  const renderSearchSelectCheckbox = (sideItem) => {
    const selectKey = searchItemSelectKey(sideItem);
    if (!selectKey) return null;
    const isSelected = Boolean(searchSelectedByKey[selectKey]);
    return (
      <input
        type="checkbox"
        className="marketsSearchModalSelectCheckbox"
        checked={isSelected}
        disabled={bulkFavBusy}
        onChange={(e) => {
          e.stopPropagation();
          toggleSearchItemSelected(sideItem, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={isSelected ? 'Deselect instrument' : 'Select instrument for bulk add/remove'}
      />
    );
  };

  const renderChainSideCell = (sideItem, sideLabel) => {
    const isCall = sideLabel === 'Call';
    if (!sideItem) {
      return (
        <div
          className={`marketsSearchModalChainCell marketsSearchModalChainCell--empty ${isCall ? 'marketsSearchModalChainCell--call' : 'marketsSearchModalChainCell--put'}`}
        >
          <span className="marketsSearchModalChainEmpty">—</span>
        </div>
      );
    }
    const symbol = String(sideItem.pairsymbol || sideItem.pairname || '').trim();
    const favToggleKey = itemKey(symbol, 'india');
    const isTogglingThis = togglingKey === favToggleKey;
    const isFav = indiaFavoriteSymbolsSet.has(normalizeFavSymbol(symbol));
    const pairLabel = formatIndianOrderPairDisplay(sideItem.pairsymbol) || symbol;
    const lotStr =
      sideItem.lotsize != null && sideItem.lotsize !== '' ? String(sideItem.lotsize) : '';
    const mainBtn = (
      <button
        type="button"
        className="marketsSearchModalChainMain"
        onClick={() => handleSelectStock(sideItem)}
        title={symbol || undefined}
        aria-label={symbol ? `Select ${symbol}` : `Select ${pairLabel}`}
      >
        <span className="marketsSearchModalChainPairLine">{pairLabel}</span>
        {/* {lotStr ? (
          <span className="marketsSearchModalChainLotBadge">Lot {lotStr}</span>
        ) : null} */}
      </button>
    );
    const selectCheckbox = renderSearchSelectCheckbox(sideItem);
    const favBtn = (
      <button
        type="button"
        className={
          isFav
            ? 'marketsSearchModalScriptBtn marketsSearchModalScriptBtn--remove marketsSearchModalChainFavBtn'
            : 'marketsSearchModalScriptBtn marketsSearchModalScriptBtn--add marketsSearchModalChainFavBtn'
        }
        onClick={(e) => {
          e.stopPropagation();
          handleModalToggleFavorite(sideItem);
        }}
        disabled={isTogglingThis || bulkFavBusy}
        aria-busy={isTogglingThis}
        aria-label={isFav ? 'Remove from list' : 'Add to list'}
      >
        {isTogglingThis ? (
          <span className="marketsSearchModalBtnSpinner" aria-hidden="true" />
        ) : isFav ? (
          'Del'
        ) : (
          'Add'
        )}
      </button>
    );
    return (
      <div
        className={`marketsSearchModalChainCell ${isCall ? 'marketsSearchModalChainCell--call' : 'marketsSearchModalChainCell--put'} ${isFav ? 'fav' : ''}`}
      >
        {isCall ? (
          <>
            {mainBtn}
            {selectCheckbox}
            {favBtn}
          </>
        ) : (
          <>
            {selectCheckbox}
            {favBtn}
            {mainBtn}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="marketsPage marketsPage--indiaNoVScroll">
      <Header />
      <div className="marketsContainer">
        <div className="marketsHeader">
          <div className="marketsHeaderContent">
            <div className="marketsHeaderText">
              <h1 className="marketsTitle">Indian Markets</h1>
              <p className="marketsSubtitle">Trade Indian stocks and indices</p>
            </div>
            {/* <div className="wsStatusContainer">
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
            </div> */}
          </div>
        </div>

        <div className="marketsFilters">
          {/* <div className="searchBox">
            <svg xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 29 29" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
            </svg>
            <input
              type="text"
              placeholder="Click to search Indian markets..."
              value={searchQuery}
              onClick={openSearchModal}
              readOnly
              className="searchInput"
            />
          </div> */}

          <div className="inlineFiltersContainer">
            <div className="filterGroup">
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>SEGMENT</label>
              <MarketsSearchCustomSelect
                disabled={fetchingSegments}
                value={filterSegment}
                onChange={(val) => { setFilterSegment(val); setFilterScript(''); setFilterExpiry(''); setFilterCePe(''); setFilterStrike(''); }}
                className="inlineCustomSelect"
                placeholder={fetchingSegments ? 'Loading...' : 'Select Segment'}
                options={segmentOptions.map(opt => ({ value: opt, label: opt }))}
                withAll={false}
                searchable={true}
              />
            </div>

            {/* <div className="marketsFilterActions">
              <button
                className={`filterBtn ${showFavorites ? 'active' : ''}`}
              // onClick={() => setShowFavorites(!showFavorites)}
              >
                
                My List ({indiaFavouritesCount})
              </button>
              
            </div> */}

            <div className="filterGroup">
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>SCRIPT</label>
              <MarketsSearchCustomSelect
                disabled={!filterSegment || fetchingScripts}
                value={filterScript}
                onChange={(val) => { setFilterScript(val); setFilterExpiry(''); setFilterCePe(''); setFilterStrike(''); }}
                className="inlineCustomSelect"
                placeholder={fetchingScripts ? 'Loading...' : 'Select Script'}
                options={scriptOptions.map(opt => ({ value: opt, label: opt }))}
                withAll={false}
                searchable={true}
              />
            </div>

            <div className="filterGroup">
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>EXPIRY</label>
              <MarketsSearchCustomSelect
                disabled={!filterScript || fetchingExpiries}
                value={filterExpiry}
                onChange={(val) => { setFilterExpiry(val); setFilterCePe(''); setFilterStrike(''); }}
                className="inlineCustomSelect"
                placeholder={fetchingExpiries ? 'Loading...' : 'Select Expiry'}
                options={expiryOptions.map(opt => ({ value: opt, label: formatExpiryLabel(opt) }))}
                withAll={false}
                searchable={true}
              />
            </div>

            <div className="filterGroup">
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>CE / PE</label>
              <MarketsSearchCustomSelect
                disabled={!filterExpiry || String(filterSegment || '').toUpperCase().endsWith('FUT') || fetchingCePes}
                value={filterCePe}
                onChange={(val) => setFilterCePe(val)}
                className="inlineCustomSelect"
                placeholder={String(filterSegment || '').toUpperCase().endsWith('FUT') ? 'Select...' : (fetchingCePes ? 'Loading...' : 'Select...')}
                options={cePeOptions.map(opt => ({ value: opt, label: opt }))}
                withAll={false}
                searchable={true}
              />
            </div>

            <div className="filterGroup">
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>STRIKE</label>
              <MarketsSearchCustomSelect
                disabled={!filterExpiry || String(filterSegment || '').toUpperCase().endsWith('FUT') || fetchingStrikes}
                value={filterStrike}
                onChange={(val) => setFilterStrike(val)}
                className="inlineCustomSelect"
                placeholder={String(filterSegment || '').toUpperCase().endsWith('FUT') ? 'Select...' : (fetchingStrikes ? 'Loading...' : 'Select...')}
                options={strikeOptions.map(opt => ({ value: opt, label: opt }))}
                withAll={false}
                searchable={true}
              />
            </div>

            <div className="addBtnGroup">
              <button type="button" onClick={handleInlineAdd} disabled={bulkFavBusy || togglingKey} style={{ padding: '0 20px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--brand-primary, #ffd500) 0%, var(--brand-primary-light, #ffe033) 100%)', color: 'var(--btn-primary-text, black)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', height: '40px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(255, 213, 0, 0.2)', transition: 'transform 0.1s, box-shadow 0.2s', whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add
              </button>
            </div>

            <div className="searchGroup">
              <div style={{ position: 'relative' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary, #64748b)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '12px' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search market..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        <IndiaMarkets
          searchQuery={searchQuery}
          stockList={stockList}
          favouritesList={favouritesList}
          watchlistList={watchlistList}
          favoritesSet={favoritesSet}
          watchlistSet={watchlistSet}
          itemKey={itemKey}
          onToggleFavorite={toggleFavorite}
          onToggleWatchlist={toggleWatchlist}
          onMarketClick={handleMarketClick}
          showFavorites={showFavorites}
          showWatchlist={showWatchlist}
          sortBy={sortBy}
        />
      </div>

      {isSearchModalOpen && (
        <div className="marketsSearchModalOverlay marketsSearchModalOverlay--fullscreen" onClick={closeSearchModal}>
          {/* <div className="marketsSearchModal marketsSearchModal--simple" onClick={(e) => e.stopPropagation()}>
            <div className="indiaSearchHeader">
              <div className="indiaSearchInputWrap">
                <svg className="indiaSearchInputIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Search GOLD, CRUDEOIL, NIFTY, strike, expiry…"
                  className="indiaSearchInput"
                  autoFocus
                />
                <kbd className="indiaSearchEscHint">ESC</kbd>
              </div>
              <button type="button" className="marketsSearchModalClose" onClick={closeSearchModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="indiaSearchToolbar">
              <div className="marketsSearchChips" role="group" aria-label="Product type">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'futures', label: 'Futures' },
                  { id: 'options', label: 'Options' },
                  { id: 'equity', label: 'Cash' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`marketsSearchChip ${searchProductKind === c.id ? 'marketsSearchChip--active' : ''}`}
                    onClick={() => setSearchProductKind(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="marketsSearchChips indiaSearchExchangeChips" role="group" aria-label="Exchange">
                <button
                  type="button"
                  className={`marketsSearchChip ${searchExchange === 'all' ? 'marketsSearchChip--active' : ''}`}
                  onClick={() => setSearchExchange('all')}
                >
                  All Exch
                </button>
                {modalExchangeOptions.slice(0, 5).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`marketsSearchChip ${searchExchange === opt.value ? 'marketsSearchChip--active' : ''}`}
                    onClick={() => setSearchExchange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`indiaSearchFiltersToggle ${showSearchFilters ? 'indiaSearchFiltersToggle--open' : ''}`}
                onClick={() => setShowSearchFilters((v) => !v)}
              >
                {showSearchFilters ? 'Hide filters' : 'More filters'}
              </button>
            </div>

            {showSearchFilters ? (
              <div className="indiaSearchFilterPanel">
                <label className="marketsSearchFilterField">
                  <span className="marketsSearchFilterLabel">Segment</span>
                  <MarketsSearchCustomSelect
                    value={searchSegment}
                    onChange={setSearchSegment}
                    options={modalSegmentOptions}
                    allLabel="All segments"
                    ariaLabel="Segment filter"
                  />
                </label>
                <label className="marketsSearchFilterField">
                  <span className="marketsSearchFilterLabel">Expiry</span>
                  <MarketsSearchCustomSelect
                    value={searchExpiry}
                    onChange={setSearchExpiry}
                    options={modalExpiryOptions}
                    allLabel="All expiries"
                    menuTall
                    ariaLabel="Expiry filter"
                  />
                </label>
                <label className="marketsSearchFilterField">
                  <span className="marketsSearchFilterLabel">Instrument</span>
                  <MarketsSearchCustomSelect
                    value={searchInstrumentType}
                    onChange={setSearchInstrumentType}
                    options={modalInstrumentOptions}
                    allLabel="All types"
                    ariaLabel="Instrument type filter"
                  />
                </label>
                <button
                  type="button"
                  className="marketsSearchClearFilters"
                  onClick={() => {
                    setSearchProductKind('all');
                    setSearchSegment('all');
                    setSearchExchange('all');
                    setSearchExpiry('all');
                    setSearchInstrumentType('all');
                  }}
                >
                  Reset
                </button>
              </div>
            ) : null}

            <div className="indiaSearchMeta">
              {stockListLoading
                ? 'Loading instruments…'
                : searchInputReady
                  ? `${totalMatchCount.toLocaleString()} instrument${totalMatchCount === 1 ? '' : 's'}`
                  : `Search from ${stockList.length.toLocaleString()} instruments`}
            </div>

            <div className="indiaSearchResults">
              {stockListLoading ? (
                <div className="marketsSearchModalState">Loading stock list…</div>
              ) : !searchInputReady ? (
                <div className="marketsSearchModalState">
                  <p className="indiaSearchEmptyTitle">Find MCX / NSE instruments</p>
                  <p className="indiaSearchEmptyHint">
                    Type a symbol like <strong>GOLD</strong>, <strong>CRUDEOIL</strong>, or <strong>NIFTY</strong>.
                    Use filters for futures, options, or exchange.
                  </p>
                </div>
              ) : totalMatchCount === 0 ? (
                <div className="marketsSearchModalState">No instruments found. Try a different symbol or reset filters.</div>
              ) : (
                <>
                  <div className="indiaSearchTableHead">
                    <span>Instrument</span>
                    <span>Expiry</span>
                    <span>Type</span>
                    <span />
                  </div>
                  <div className="indiaSearchTableBody">
                    {visibleFlatSearchResults.map((item) => renderSimpleSearchRow(item))}
                  </div>
                  {hasMoreFlatResults ? (
                    <div className="marketsSearchLoadMoreWrap">
                      <button
                        type="button"
                        className="marketsSearchClearFilters"
                        onClick={() => setFlatSearchLimit((n) => n + FLAT_SEARCH_PAGE)}
                      >
                        Load more ({(filteredStockList.length - flatSearchLimit).toLocaleString()} remaining)
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default IndianMarketsPage;
