import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { copyToClipboard } from '../utils/clipboard';
import {
  getOrderHistory,
  closeOrder,
  closeAllOrders,
  updateOrderTpSl,
  cancelOrder
} from '../services/tradingApi';
import {
  useOrderListWebSocket,
  ORDER_OPEN_LIST_WS_URL,
  ORDER_PENDING_LIST_WS_URL,
} from '../hooks/useOrderListWebSocket';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { normalizeSymbol } from '../services/favouritesWishlistApi';
import { useAvaxTradesWebSocket } from '../hooks/useAvaxTradesWebSocket';
import useMarketWebSocket from '../hooks/useMarketWebSocket';
import { formatIndianOrderPairDisplay, formatPriceUtil } from '../utils/helper';
import { INDIA_INR_PER_USDT } from '../utils/tradingCalculations';
import TP_SL_Modal from '../components/TP_SL_Modal';
import Header from '../components/Header';
import CustomSelect from '../components/CustomSelect';
import '../styles/pages/Orders.css';
import { tokenStorage } from '../utils/storage';
import { resolveOrderNo } from '../utils/orderDisplay';
import logo from "../../public/assets/img/icon.png"
// import darklogo from "../../public/assets/img/m5dex-dark-logo.png"

const statusOptions = [
  { id: 'all', label: 'All Status' },
  { id: 'filled', label: 'Filled' },
  { id: 'partial', label: 'Partially Filled' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'rejected', label: 'Rejected' },
];

const dateRanges = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

const tradingPairs = [
  {
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
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
    symbol: 'ETH/USDT',
    base: 'ETH',
    quote: 'USDT',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 15 24"
        fill="none"
      >
        <path
          d="M7.1542 0.5L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 0.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.15421 23.5001V18.4242"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 23.5L0.500061 14.2445L7.1542 18.4241L13.7925 14.2048L7.1542 23.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 9.06555L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 9.06555Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.15421 0.5V16.3621"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 0.5L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 0.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    symbol: 'BNB/USDT',
    base: 'BNB',
    quote: 'USDT',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 25 23"
        fill="none"
      >
        <path
          d="M25 10.8697C25 9.30262 20.7106 7.99513 15.0105 7.69347L15.0101 5.19653H22.1273V0H2.66585V5.19653H9.78253V7.70568C4.18624 8.02802 0 9.32187 0 10.8697C0 12.4178 4.18624 13.7118 9.78253 14.0336V23H15.0101V14.0458C20.7106 13.7448 25 12.4369 25 10.8697ZM12.4999 12.4135C6.38166 12.4135 1.42168 11.4722 1.42168 10.3102C1.42168 9.32638 4.97824 8.50041 9.78253 8.2706V8.86279H9.78308V11.2895C10.6492 11.3378 11.5595 11.3631 12.4999 11.3631C13.3659 11.3631 14.2068 11.3413 15.0106 11.3012V8.26157C19.9191 8.47731 23.5784 9.31197 23.5784 10.3102C23.5783 11.4722 18.6182 12.4135 12.4999 12.4135Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    symbol: 'SOL/USDT',
    base: 'SOL',
    quote: 'USDT',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 25 23"
        fill="none"
      >
        <path
          d="M17.7269 9.29257L12.6775 4.24323C12.5337 4.0995 12.3388 4.01876 12.1355 4.01876C11.9322 4.01876 11.7372 4.0995 11.5934 4.24323L6.5441 9.29257C6.40032 9.4363 6.20535 9.51705 6.00205 9.51705C5.79876 9.51705 5.60379 9.4363 5.46001 9.29257L4.37593 8.20849C4.2322 8.06472 4.15146 7.86975 4.15146 7.66645C4.15146 7.46315 4.2322 7.26818 4.37593 7.12441L11.0514 0.448946C11.3389 0.161486 11.7289 0 12.1355 0C12.5421 0 12.932 0.161486 13.2196 0.448946L19.895 7.12441C20.0388 7.26818 20.1195 7.46315 20.1195 7.66645C20.1195 7.86975 20.0388 8.06472 19.895 8.20849L18.8109 9.29257C18.6672 9.4363 18.4722 9.51705 18.2689 9.51705C18.0656 9.51705 17.8706 9.4363 17.7269 9.29257Z"
          fill="currentColor"
        />
        <path
          d="M12.1355 23C11.9341 23.0002 11.7347 22.9607 11.5486 22.8836C11.3626 22.8065 11.1936 22.6934 11.0514 22.5508L4.37593 15.8753C4.2322 15.7315 4.15146 15.5366 4.15146 15.3333C4.15146 15.13 4.2322 14.935 4.37593 14.7912L5.46001 13.7071C5.60379 13.5634 5.79876 13.4827 6.00205 13.4827C6.20535 13.4827 6.40032 13.5634 6.5441 13.7071L11.5934 18.7565C11.7372 18.9002 11.9322 18.981 12.1355 18.981C12.3388 18.981 12.5337 18.9002 12.6775 18.7565L17.7269 13.7071C17.8706 13.5634 18.0656 13.4827 18.2689 13.4827C18.4722 13.4827 18.6672 13.5634 18.8109 13.7071L19.895 14.7912C20.0388 14.935 20.1195 15.13 20.1195 15.3333C20.1195 15.5366 20.0388 15.7315 19.895 15.8753L13.2196 22.5508C13.0774 22.6934 12.9084 22.8065 12.7223 22.8836C12.5363 22.9607 12.3369 23.0002 12.1355 23Z"
          fill="currentColor"
        />
        <path
          d="M13.762 10.9574L12.6777 9.87318C12.3783 9.57377 11.8929 9.57377 11.5935 9.87318L10.5093 10.9574C10.2098 11.2568 10.2098 11.7423 10.5093 12.0417L11.5935 13.1259C11.8929 13.4253 12.3783 13.4253 12.6777 13.1259L13.762 12.0417C14.0614 11.7423 14.0614 11.2568 13.762 10.9574Z"
          fill="currentColor"
        />
        <path
          d="M3.79486 10.9579L2.71061 9.87367C2.4112 9.57426 1.92577 9.57426 1.62636 9.87367L0.542119 10.9579C0.242712 11.2573 0.242712 11.7428 0.542118 12.0422L1.62636 13.1264C1.92577 13.4258 2.4112 13.4258 2.71061 13.1264L3.79486 12.0422C4.09426 11.7428 4.09426 11.2573 3.79486 10.9579Z"
          fill="currentColor"
        />
        <path
          d="M23.7283 10.9578L22.6441 9.87354C22.3447 9.57414 21.8592 9.57414 21.5598 9.87354L20.4756 10.9578C20.1762 11.2572 20.1762 11.7426 20.4756 12.042L21.5598 13.1263C21.8592 13.4257 22.3447 13.4257 22.6441 13.1263L23.7283 12.042C24.0277 11.7426 24.0277 11.2572 23.7283 10.9578Z"
          fill="currentColor"
        />
      </svg>
    )
  },
];

const orderTypes = [
  { id: 'all', label: 'All Types' },
  { id: 'limit', label: 'Limit Order' },
  { id: 'market', label: 'Market Order' },
  // { id: 'stop-limit', label: 'Stop-Limit' },
  // { id: 'stop-market', label: 'Stop-Market' },
  // { id: 'trailing', label: 'Trailing Stop' },
];

const WS_BASE_BY_TYPE = {
  forex: import.meta.env.VITE_WS_URL ?? 'wss://arkwebsocket.blockcryp.com/forex/ws',
  crypto: import.meta.env.VITE_WS_AVAX_TRADES_URL ?? 'ws://206.189.120.57:8000/ws',
  indices: 'wss://arkwebsocket.blockcryp.com/indices/ws',
  metals: 'wss://arkwebsocket.blockcryp.com/metal/ws',
  india: 'wss://arkwebsocket.blockcryp.com/india/ws',
};

const WS_OPTIONS = {
  autoConnect: true,
  reconnectInterval: 600,
  maxReconnectInterval: 15000,
  reconnectDecay: 1.3,
  timeoutInterval: 5000,
  maxReconnectAttempts: Infinity,
  enableHeartbeat: false,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

const getWsBase = (type) =>
  WS_BASE_BY_TYPE[String(type || 'crypto').toLowerCase().trim()] ??
  import.meta.env.VITE_WS_AVAX_TRADES_URL ??
  WS_BASE_BY_TYPE.crypto;

const symbolToPair = (s) => {
  const n = normalizeSymbol(s);
  if (!n) return '-';
  const base = n.replace(/(USDT|USD|INR)$/i, '') || n;
  return `${base}/USDT`;
};

const getOrderMarketKey = (raw, symbol = '') => {
  const candidates = [
    raw?.market,
    raw?.type,
    raw?.segment,
    raw?.marketSegment,
    raw?.assetType,
    raw?.productType,
    raw?.market_type,
    raw?.marketType,
  ];
  for (const c of candidates) {
    const key = String(c ?? '').trim().toLowerCase();
    if (!key) continue;
    if (key.includes('india') || key.includes('indian')) return 'india';
    if (key.includes('forex')) return 'forex';
    if (key.includes('indice') || key.includes('index')) return 'forex';
    if (key.includes('metal') || key.includes('commodit')) return 'forex';
    if (key.includes('crypto')) return 'crypto';
  }
  const sym = String(symbol || '').toUpperCase();
  if (/^(NFO|MCX|NSE|BSE|CDS|BCD|NCDEX):/i.test(sym)) return 'india';
  if (/USDT$/i.test(sym)) return 'crypto';
  if (/^(EUR|GBP|USD|JPY|AUD|CHF|NZD|CAD)(USD|EUR|GBP|JPY|CHF|AUD|NZD|CAD)$/.test(sym) || (sym.length === 6 && !sym.endsWith('USDT'))) return 'forex';
  return 'crypto';
};

const formatExpiryDate = (expireAt) => {
  if (!expireAt) return null;
  const match = String(expireAt).match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (match) {
    const [, yyyy, mm, dd, hh, min] = match;
    if (hh && min) {
      let hourNum = parseInt(hh, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12;
      hourNum = hourNum ? hourNum : 12;
      const hourStr = String(hourNum).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hourStr}:${min} ${ampm}`;
    }
    return `${dd}-${mm}-${yyyy}`;
  }

  let d = new Date(expireAt);
  if (Number.isNaN(d.getTime())) {
    d = new Date(String(expireAt).replace(/-/g, '/'));
  }
  if (Number.isNaN(d.getTime())) return String(expireAt);

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12;
  hh = hh ? hh : 12;
  const hhStr = String(hh).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hhStr}:${min} ${ampm}`;
};

const isOrderRowForexGroup = (market) => {
  const m = String(market || '').toLowerCase();
  return m === 'forex' || m === 'metals' || m === 'commodities' || m === 'indices';
};

const orderMatchesSubTab = (orderMarket, subTab) => {
  const wanted = subTab === 'indian' ? 'india' : subTab;
  const m = String(orderMarket || '').toLowerCase();
  if (wanted === 'all') return true;
  if (wanted === 'forex') return isOrderRowForexGroup(m);
  return m === wanted;
};

const getApiPairIdByMarket = (market, pairid) => {
  const mk = String(market || '').trim().toLowerCase();
  if (mk === 'crypto' || mk === 'forex') return 0;
  if (pairid == null || String(pairid).trim() === '') return '';
  return pairid;
};

const getApiTypeByMarket = (market) => {
  const mk = String(market || '').trim().toLowerCase();
  if (!mk) return null;
  if (mk === 'india' || mk === 'indian') return 'indian';
  return mk;
};

const getPairDisplayByMarket = (market, symbolRaw, symbol) => {
  if (market === 'india') return formatIndianOrderPairDisplay(symbolRaw || symbol || '-') || String(symbolRaw || symbol || '-');
  return symbolToPair(symbolRaw || symbol);
};

const getPriceFromMarketItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const v = item.price ?? item.p ?? item.last ?? item.close ?? item.c ?? item.Last ?? item.Close;
  const n = v != null ? Number(v) : null;
  return n != null && !Number.isNaN(n) ? n : null;
};

/** Normalize India tick fields to consistent numeric price/bid/ask. */
const normalizeIndiaTradesList = (list) => {
  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return (Array.isArray(list) ? list : []).map((x) => {
    const price = toNum(x?.price ?? x?.ltp ?? x?.p ?? x?.index ?? x?.last ?? x?.close, 0);
    const bid = toNum(x?.bid ?? x?.b ?? x?.bidPrice, price);
    const ask = toNum(x?.ask ?? x?.a ?? x?.askPrice, price);
    return {
      ...x,
      price,
      index: price,
      bid,
      ask,
      lastUpdate: x?.lastUpdate ?? x?.timestamp ?? x?.time ?? x?.T ?? Date.now(),
    };
  });
};

const resolveUsdtInrRate = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : INDIA_INR_PER_USDT;
};

const getStatusBadge = (status) => {
  const badges = {
    open: { label: 'Open', color: 'success', icon: '🟢' },
    partial: { label: 'Partial', color: 'warning', icon: '🟡' },
    filled: { label: 'Filled', color: 'success', icon: '✓' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: '⊗' },
    expired: { label: 'Expired', color: 'warning', icon: '⏱' },
    rejected: { label: 'Rejected', color: 'danger', icon: '✗' },
  };
  return badges[status] || badges.open;
};

const getTypeBadge = (type) => {
  const badges = {
    limit: { label: 'Limit', color: 'primary' },
    market: { label: 'Market', color: 'success' },
    'stop-limit': { label: 'Stop-Limit', color: 'warning' },
    'stop-market': { label: 'Stop-Market', color: 'danger' },
    trailing: { label: 'Trailing', color: 'info' },
  };
  return badges[type] || badges.limit;
};

const Orders = () => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const columnSettingsRef = useRef(null);
  const exportDropdownRef = useRef(null);
  const { showError, showSuccess } = useToast();
  const { usdtInrRate } = useUser();
  const [activeTab, setActiveTab] = useState('open');
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [indiaPnlCurrency, setIndiaPnlCurrency] = useState('usdt');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [showPairDropdown, setShowPairDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [orderToShare, setOrderToShare] = useState(null);
  const [orderToShareId, setOrderToShareId] = useState(null);
  const [orderToShareTab, setOrderToShareTab] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState(null);
  const shareTemplateRef = useRef(null);
  const [cancellingIds, setCancellingIds] = useState([]);
  const [cancellingAll, setCancellingAll] = useState(false);
  const [openOrdersRaw, setOpenOrdersRaw] = useState([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [openOrdersError, setOpenOrdersError] = useState(null);
  const [pendingOrdersRaw, setPendingOrdersRaw] = useState([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [pendingOrdersError, setPendingOrdersError] = useState(null);
  const [orderHistoryRaw, setOrderHistoryRaw] = useState([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState(null);
  const [tpslModalOpen, setTpslModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [tpslSaving, setTpslSaving] = useState(false);
  const [refreshOrderTrigger, setRefreshOrderTrigger] = useState(0);
  const isAuthForOrdersWs = tokenStorage.hasToken();
  const openOrderWsPage = useOrderListWebSocket(ORDER_OPEN_LIST_WS_URL, isAuthForOrdersWs);
  const pendingOrderWsPage = useOrderListWebSocket(ORDER_PENDING_LIST_WS_URL, isAuthForOrdersWs);
  const [visibleColumns, setVisibleColumns] = useState({
    open: {
      dateTime: true,
      pair: true,
      type: false,
      side: true,
      price: true,
      liquidityPrice: false,
      lotSize: true,
      filled: false,
      total: false,
      currentPrice: true,
      tpsl: true,
      pnl: true,
      actions: true,
    },
    history: {
      dateTime: true,
      pair: true,
      type: true,
      side: true,
      price: true,
      lotSize: true,
      tpsl: true,
      filled: true,
      avgFillPrice: true,
      // completionTime: true,
      fee: true,
      pnl: true,
      // status: true,
      actions: true,
    },
    pending: {
      time: true,
      pair: true,
      side: true,
      type: true,
      price: true,
      lotSize: true,
      liquidityPrice: true,
      tpsl: true,
      total: true,
      fee: true,
      actions: true
      // feeAsset: true,
      // role: true,
      // orderId: true,
      // orderno: true
    },
  });

  const triggerOrderRefresh = () => setRefreshOrderTrigger(prev => prev + 1);

  const wsUrlCrypto = useMemo(() => {
    const base = (getWsBase('crypto') || '').replace(/\/+$/, '');
    return base.endsWith('/all') ? base : `${base}/all`;
  }, []);

  const wsUrlForex = useMemo(() => {
    const base = (getWsBase('forex') || '').replace(/\/+$/, '');
    return base.endsWith('/all') ? base : `${base}/all`;
  }, []);
  const wsUrlIndiaAll = useMemo(() => {
    const raw = import.meta.env.VITE_WS_INDIA_URL || getWsBase('india');
    if (!raw) return null;
    return String(raw).replace(/\/+$/, '');
  }, []);

  const isDirectStream = wsUrlForex.includes('/ws/') && wsUrlForex.split('/ws/').length > 1;

  const { tradesData: tradesDataCrypto } = useAvaxTradesWebSocket(wsUrlCrypto, null, WS_OPTIONS);
  const { tradesData: tradesDataIndiaAll } = useAvaxTradesWebSocket(wsUrlIndiaAll, null, WS_OPTIONS);
  const { marketData } = useMarketWebSocket([], null, { autoSubscribe: !isDirectStream });
  const normalizedIndiaAllTradesData = useMemo(
    () => normalizeIndiaTradesList(tradesDataIndiaAll),
    [tradesDataIndiaAll]
  );

  const uniqueMarketsData = useMemo(() => {
    if (!marketData || marketData.size === 0) return [];

    const uniqueMap = new Map();

    for (const market of marketData.values()) {
      const rawSymbol = market.symbol || market.Symbol || market.id || market.instrument || market.pair || market.market || '';
      const normalizedKey = normalizeSymbol(rawSymbol);

      if (!normalizedKey) continue;

      const marketType = market.marketType || 'forex';
      if (marketType !== 'forex') continue;

      const existing = uniqueMap.get(normalizedKey);
      if (!existing || (market.lastUpdate && market.lastUpdate > (existing.lastUpdate || 0))) {
        uniqueMap.set(normalizedKey, {
          ...market,
          id: normalizedKey,
          symbol: market.symbol || rawSymbol,
          base: market.base || normalizedKey.substring(0, 3) || 'XXX',
          quote: market.quote || normalizedKey.substring(3) || 'USD',
          price: market.price || market.index || 0,
          index: market.index || market.price || 0,
          ask: market.ask || market.price || 0,
          bid: market.bid || market.price || 0,
          change24h: market.change24h || 0,
          volume24h: market.volume24h || 0,
          high24h: market.high24h || 0,
          low24h: market.low24h || 0,
          lastUpdate: market.lastUpdate || Date.now(),
          marketType: 'forex',
        });
      }
    }

    return Array.from(uniqueMap.values());
  }, [marketData]);

  const buildSymbolPriceMap = (list = [], getPrice) => {
    const map = new Map();

    (Array.isArray(list) ? list : []).forEach((item) => {
      const rawSymbol =
        item?.symbol ??
        item?.s ??
        item?.id ??
        item?.Symbol ??
        item?.instrument ??
        item?.pair ??
        item?.market ??
        '';

      const key = normalizeSymbol(rawSymbol);
      if (!key) return;

      const price = getPrice(item);

      if (price != null && price > 0) {
        map.set(key, price);
      }
    });

    return map;
  };

  const symbolToPriceMap = useMemo(() => {
    return buildSymbolPriceMap(tradesDataCrypto, (item) =>
      getPriceFromMarketItem(item)
    );
  }, [tradesDataCrypto]);

  const forexSymbolToPriceMap = useMemo(() => {
    return buildSymbolPriceMap(uniqueMarketsData, (item) =>
      Number(item?.price ?? item?.index ?? item?.ask ?? item?.bid ?? 0)
    );
  }, [uniqueMarketsData]);

  const indiaSymbolToPriceMap = useMemo(() => {
    return buildSymbolPriceMap(normalizedIndiaAllTradesData, (item) =>
      Number(item?.price ?? item?.ltp ?? item?.index ?? item?.ask ?? item?.bid ?? 0)
    );
  }, [normalizedIndiaAllTradesData]);

  const priceMap = useMemo(() => new Map([
    ...symbolToPriceMap,
    ...forexSymbolToPriceMap,
    ...indiaSymbolToPriceMap,
  ]), [symbolToPriceMap, forexSymbolToPriceMap, indiaSymbolToPriceMap]);

  const reconnectOrderListWs = useCallback(() => {
    if (!isAuthForOrdersWs) return;
    openOrderWsPage.reconnect();
    pendingOrderWsPage.reconnect();
  }, [isAuthForOrdersWs, openOrderWsPage.reconnect, pendingOrderWsPage.reconnect]);

  // open orders from websocket
  useEffect(() => {
    setOpenOrdersRaw(openOrderWsPage.orders);
  }, [openOrderWsPage.orders]);

  useEffect(() => {
    if (!isAuthForOrdersWs) {
      setOpenOrdersLoading(false);
      setOpenOrdersError(null);
      return;
    }
    if (openOrderWsPage.hasSnapshot) {
      setOpenOrdersLoading(false);
      setOpenOrdersError(null);
      return;
    }
    if (openOrderWsPage.error) {
      setOpenOrdersError(openOrderWsPage.error?.message || String(openOrderWsPage.error));
      setOpenOrdersLoading(false);
      return;
    }
    setOpenOrdersLoading(true);
    setOpenOrdersError(null);
  }, [isAuthForOrdersWs, openOrderWsPage.hasSnapshot, openOrderWsPage.error]);

  // order history
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setOrderHistoryLoading(true);
      setOrderHistoryError(null);
      try {
        const res = await getOrderHistory();
        const data = res?.data ?? res?.result ?? res ?? {};
        const list = Array.isArray(data)
          ? data
          : (Array.isArray(data?.data) ? data.data : null)
          ?? (Array.isArray(data?.list) ? data.list : null)
          ?? (Array.isArray(data?.orders) ? data.orders : null)
          ?? (Array.isArray(data?.history) ? data.history : null)
          ?? [];
        if (!cancelled) setOrderHistoryRaw(list);
      } catch (err) {
        const msg = err?.message || err?.data?.message || 'Failed to load order history';
        if (!cancelled) {
          setOrderHistoryError(msg);
          setOrderHistoryRaw([]);
        }
        showError(msg, 5000);
      } finally {
        if (!cancelled) setOrderHistoryLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [showError]);

  // pending orders from websocket
  useEffect(() => {
    setPendingOrdersRaw(pendingOrderWsPage.orders);
  }, [pendingOrderWsPage.orders]);

  useEffect(() => {
    if (!isAuthForOrdersWs) {
      setPendingOrdersLoading(false);
      setPendingOrdersError(null);
      return;
    }
    if (pendingOrderWsPage.hasSnapshot) {
      setPendingOrdersLoading(false);
      setPendingOrdersError(null);
      return;
    }
    if (pendingOrderWsPage.error) {
      setPendingOrdersError(pendingOrderWsPage.error?.message || String(pendingOrderWsPage.error));
      setPendingOrdersLoading(false);
      return;
    }
    setPendingOrdersLoading(true);
    setPendingOrdersError(null);
  }, [isAuthForOrdersWs, pendingOrderWsPage.hasSnapshot, pendingOrderWsPage.error]);

  useEffect(() => {
    if (!isAuthForOrdersWs) return;
    const id = setInterval(() => {
      if (!openOrderWsPage.isConnected) openOrderWsPage.reconnect();
      if (!pendingOrderWsPage.isConnected) pendingOrderWsPage.reconnect();
    }, 6000);
    return () => clearInterval(id);
  }, [
    isAuthForOrdersWs,
    openOrderWsPage.isConnected,
    pendingOrderWsPage.isConnected,
    openOrderWsPage.reconnect,
    pendingOrderWsPage.reconnect,
  ]);

  const refreshOrderWsReconnectSkipRef = useRef(null);
  useEffect(() => {
    if (refreshOrderWsReconnectSkipRef.current === null) {
      refreshOrderWsReconnectSkipRef.current = refreshOrderTrigger;
      return;
    }
    if (refreshOrderWsReconnectSkipRef.current === refreshOrderTrigger) return;
    refreshOrderWsReconnectSkipRef.current = refreshOrderTrigger;
    reconnectOrderListWs();
  }, [refreshOrderTrigger, reconnectOrderListWs]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPairDropdown(false);
        setShowTypeDropdown(false);
        setShowStatusDropdown(false);
        setShowDateDropdown(false);
      }
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(event.target)) {
        setShowColumnSettings(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openOrders = useMemo(() => {
    const fxRate = resolveUsdtInrRate(usdtInrRate);
    return (Array.isArray(openOrdersRaw) ? openOrdersRaw : []).map((raw, idx) => {
      const rawId = raw?.id ?? raw?.orderId ?? raw?.usertranid ?? raw?._id;
      const orderNo = raw?.orderno ?? raw?.orderNo ?? null;
      const displayId = rawId != null ? String(rawId) : `open-${idx}`;
      const id = `${displayId}-${idx}`;
      const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '';
      const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
      const market = getOrderMarketKey(raw, symbol);
      const pair = getPairDisplayByMarket(market, symbolRaw, symbol);
      const pairid = raw?.type;
      const lotsize = raw?.lotsize;
      const base = symbol.replace(/(USDT|USD|INR)$/i, '') || symbol || 'NA';
      const sideRaw = String(raw?.ordertype ?? '').toLowerCase();
      const side = sideRaw === 'sell' ? 'sell' : 'buy';
      const marketTypeRaw = String(raw?.markettype ?? raw?.marketType ?? raw?.type ?? '').toUpperCase();
      const type = marketTypeRaw === 'MARKET' ? 'market' : 'limit';
      const price = Number(raw?.price ?? raw?.openPrice ?? 0) || 0;
      const lotSize = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? 0) || 0;
      const total = Number(raw?.totalamt ?? raw?.totalAmt ?? 0) || price * lotSize;
      const usedMargin = Number(raw?.usedmargin ?? raw?.usedMargin ?? 0) || 0;
      const leverage = Number(raw?.leverage ?? 0) || 0;
      const status = String(raw?.istatus ?? raw?.status ?? 'OPEN').toLowerCase();
      const createdAt = raw?.ondate ?? raw?.openTime ?? raw?.createdAt ?? raw?.time ?? raw?.timestamp ?? null;
      const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

      const fee = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
      const tp = raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? null;
      const sl = raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? null;
      const fromApiPrice = Number(raw?.liveprice ?? raw?.currentPrice ?? raw?.markPrice ?? raw?.lastPrice ?? 0) || null;
      const fromApiPriceValid = fromApiPrice != null && !Number.isNaN(fromApiPrice) && fromApiPrice > 0;
      const livePrice = priceMap.get(symbol) ?? null;
      const currentPrice = (livePrice != null && livePrice > 0 ? livePrice : null) ?? (fromApiPriceValid ? fromApiPrice : null) ?? price;
      const isSell = side === 'sell';
      const isIndiaMarket = market === 'india';
      const rawProfit = Number(raw?.profit ?? raw?.pnl ?? raw?.unrealizedPnl ?? raw?.unrealized_pnl ?? 0) || 0;
      const priceMovePct = price > 0 && currentPrice > 0 ? (currentPrice - price) / price : 0;
      const fallbackNotional = lotSize > 0 && price > 0
        ? lotSize * price
        : total;
      const fallbackNotionalUsdt = isIndiaMarket
        ? (fallbackNotional > 0 ? fallbackNotional / fxRate : 0)
        : fallbackNotional;
      const notionalExposure =
        (usedMargin > 0 && leverage > 0)
          ? usedMargin * leverage
          : fallbackNotionalUsdt;
      let profit = 0;
      if (notionalExposure > 0 && priceMovePct !== 0) {
        const directionalPct = isSell ? -priceMovePct : priceMovePct;
        profit = directionalPct * notionalExposure;
      }
      if (!Number.isFinite(profit) || profit === 0) {
        profit = rawProfit;
      }
      const totalBase = isIndiaMarket ? (total > 0 ? total / fxRate : 0) : total;
      const baseForPct = usedMargin > 0 ? usedMargin : (notionalExposure > 0 ? notionalExposure : totalBase);
      const profitPercent = baseForPct > 0 ? (profit / baseForPct) * 100 : 0;
      const liquidityPrice = Number(raw?.soprice ?? 0) || 0;
      return {
        id,
        displayId,
        rawId,
        orderNo,
        orderno: orderNo,
        pair,
        pairid,
        lotsize,
        base,
        quote: 'USDT',
        type,
        side,
        price,
        lotSize,
        filled: lotSize,
        total,
        filledTotal: total,
        status: status === 'open' ? 'partial' : status,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        triggerPrice: null,
        fee,
        feeAsset: 'USDT',
        symbol,
        currentPrice,
        usedMargin,
        leverage,
        tp: tp ?? null,
        sl: sl ?? null,
        profit: Number.isFinite(profit) ? profit : 0,
        profitPercent: Number.isFinite(profitPercent) ? profitPercent : 0,
        market,
        openPrice: price,
        liquidityPrice,
        expiryTimeFull
      };
    });
  }, [openOrdersRaw, priceMap, usdtInrRate]);

  const normalizedActiveSubTab = activeSubTab === 'indian' ? 'india' : activeSubTab;
  const inrPerUsdt = useMemo(() => {
    const n = Number(usdtInrRate);
    return Number.isFinite(n) && n > 0 ? n : INDIA_INR_PER_USDT;
  }, [usdtInrRate]);
  const isIndiaTabSelected = normalizedActiveSubTab === 'india';

  const formatPnlCurrency = useCallback((profitUsdt, market) => {
    const p = Number(profitUsdt || 0);
    const isIndiaMarket = String(market || '').toLowerCase() === 'india';
    if (!isIndiaMarket) {
      return {
        value: p,
        text: `${p >= 0 ? '+' : ''}${p.toFixed(4)} USDT`,
        unit: 'USDT',
      };
    }
    if (indiaPnlCurrency === 'inr') {
      const inrValue = p * inrPerUsdt;
      return {
        value: inrValue,
        text: `${inrValue >= 0 ? '+' : ''}${inrValue.toLocaleString('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} INR`,
        unit: 'INR',
      };
    }
    return {
      value: p,
      text: `${p >= 0 ? '+' : ''}${p.toFixed(4)} USDT`,
      unit: 'USDT',
    };
  }, [indiaPnlCurrency, inrPerUsdt]);

  const openOrdersForPnLBar = useMemo(() => {
    if (normalizedActiveSubTab === 'all') return openOrders;
    return openOrders.filter((o) => orderMatchesSubTab(o.market, activeSubTab));
  }, [openOrders, normalizedActiveSubTab, activeSubTab]);

  const cancelableOpenOrders = useMemo(() => {
    if (normalizedActiveSubTab === 'all') return openOrders;
    return openOrders.filter((o) => orderMatchesSubTab(o.market, activeSubTab));
  }, [openOrders, normalizedActiveSubTab, activeSubTab]);

  const openOrdersTotalPnL = useMemo(() => {
    const totalProfit = openOrdersForPnLBar.reduce((sum, o) => sum + (Number(o.profit) || 0), 0);
    const totalMargin = openOrdersForPnLBar.reduce((sum, o) => sum + (Number(o.usedMargin) || 0), 0);
    const totalPct = totalMargin > 0 ? (totalProfit / totalMargin) * 100 : 0;
    return { totalPnL: totalProfit, totalMargin, totalPnLPercent: totalPct, isProfit: totalProfit >= 0 };
  }, [openOrdersForPnLBar]);

  const openOrdersTotalPnlDisplay = useMemo(() => {
    const marketKey = isIndiaTabSelected ? 'india' : 'usdt';
    return formatPnlCurrency(openOrdersTotalPnL.totalPnL, marketKey);
  }, [openOrdersTotalPnL.totalPnL, isIndiaTabSelected, formatPnlCurrency]);

  const orderHistory = useMemo(() => {
    return (Array.isArray(orderHistoryRaw) ? orderHistoryRaw : []).map((raw, idx) => {
      const rawId = raw?.id ?? raw?.orderId ?? raw?.usertranid ?? raw?._id;
      const displayId = rawId != null ? String(rawId) : `hist-${idx}`;
      const id = `hist-${displayId}-${idx}`;
      const orderNo = raw?.orderno ?? raw?.orderNo ?? null;
      const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '';
      const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
      const market = getOrderMarketKey(raw, symbol);
      const pair = getPairDisplayByMarket(market, symbolRaw, symbol);
      const base = symbol.replace(/(USDT|USD|INR)$/i, '') || 'NA';
      const sideRaw = String(raw?.side ?? raw?.mode ?? raw?.direction ?? raw?.ordertype ?? '').toLowerCase();
      const side = sideRaw === 'sell' ? 'sell' : 'buy';
      const marketTypeRaw = String(raw?.markettype ?? raw?.marketType ?? raw?.type ?? '').toUpperCase();
      const type = marketTypeRaw === 'MARKET' ? 'market' : 'limit';
      const price = Number(raw?.openprice ?? raw?.openPrice ?? raw?.price ?? 0) || 0;
      const closePrice = Number(raw?.price ?? raw?.closeprice ?? raw?.closePrice ?? 0) || 0;
      const lotSize = Number(raw?.quantity ?? raw?.lotsize ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? 0) || 0;
      const total = Number(raw?.totalamt ?? raw?.totalAmt ?? 0) || 0;
      const status = String(raw?.istatus ?? raw?.status ?? raw?.orderStatus ?? 'closed').toLowerCase();
      const closedAt = raw?.closedAt ?? raw?.closed_at ?? raw?.ondate ?? raw?.createdAt ?? raw?.time ?? raw?.timestamp ?? null;
      const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

      const fee = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
      const tp = raw?.current_profitrade ?? raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? null;
      const sl = raw?.current_stoploss ?? raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? null;
      const profit = Number(raw?.pnlamount ?? raw?.profit ?? raw?.pnl ?? raw?.realizedPnl ?? raw?.realized_pnl ?? 0) || 0;
      const profitPct = Number(raw?.pnlpercent ?? raw?.profitPercent ?? raw?.profitpercent ?? 0) || 0;

      return {
        id,
        displayId,
        orderNo,
        orderno: orderNo,
        pair,
        base,
        quote: 'USDT',
        type,
        side,
        price,
        closePrice,
        lotSize,
        filled: lotSize,
        total,
        filledTotal: total,
        status: status === 'open' ? 'filled' : status,
        createdAt: closedAt ? new Date(closedAt) : new Date(),
        completedAt: closedAt ? new Date(closedAt) : new Date(),
        avgFillPrice: closePrice || price,
        fee,
        feeAsset: 'USDT',
        tp: tp ?? null,
        sl: sl ?? null,
        profit: Number.isFinite(profit) ? profit : 0,
        profitPct: Number.isFinite(profitPct) ? profitPct : 0,
        market,
        symbol,
        raw,
        tpslActions: Array.isArray(raw?.tpsl_actions) ? raw.tpsl_actions : [],
        expiryTimeFull
      };
    });
  }, [orderHistoryRaw]);

  const pendingOrders = useMemo(() => {
    return (Array.isArray(pendingOrdersRaw) ? pendingOrdersRaw : []).map((raw, idx) => {
      const orderNo = raw?.orderno ?? raw?.orderNo;
      const rawId = raw?.id ?? raw?.orderId ?? raw?.usertranid ?? raw?._id;
      const displayId = orderNo != null ? String(orderNo) : `pending-${idx}`;
      // const displayId = rawId != null ? String(rawId) : `pending-${idx}`;
      const id = `pending-${displayId}-${idx}`;
      const symbolRaw = raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '';
      const symbol = normalizeSymbol(symbolRaw) || String(symbolRaw).replace(/\//g, '').toUpperCase().trim() || '-';
      const market = getOrderMarketKey(raw, symbol);
      const pair = getPairDisplayByMarket(market, symbolRaw, symbol);
      const base = (normalizeSymbol(symbolRaw) || '').replace(/(USDT|USD|INR)$/i, '') || 'NA';
      const sideRaw = String(raw?.side ?? raw?.mode ?? raw?.direction ?? '').toLowerCase();
      const side = sideRaw === 'sell' ? 'sell' : 'buy';
      const marketTypeRaw = String(raw?.markettype ?? raw?.marketType ?? raw?.type ?? '').toUpperCase();
      const type = marketTypeRaw === 'MARKET' ? 'market' : 'limit';
      const price = Number(raw?.price ?? raw?.orderPrice ?? raw?.limitPrice ?? 0) || 0;
      const lotSize = Number(raw?.quantity ?? raw?.qty ?? raw?.size ?? raw?.volume ?? raw?.amount ?? 0) || 0;
      const total = price * lotSize;
      const fee = Number(raw?.tranfee ?? raw?.commission ?? raw?.fee ?? 0) || 0;
      const createdAt = raw?.ondate ?? raw?.createdAt ?? raw?.time ?? raw?.timestamp ?? null;
      const expiryTimeFull = formatExpiryDate(raw?.expireddate ?? raw?.expiredDate ?? raw?.expirydate ?? raw?.expiryDate ?? null);

      const tp = raw?.profitrade ?? raw?.tradeprofit ?? raw?.tp ?? raw?.takeProfit ?? null;
      const sl = raw?.stoploss ?? raw?.stopLoss ?? raw?.sl ?? null;
      const liquidityPrice = Number(raw?.soprice ?? 0) || 0;
      const fromApiPrice = Number(raw?.liveprice ?? raw?.currentPrice ?? raw?.markPrice ?? raw?.lastPrice ?? 0) || null;
      const fromApiPriceValid = fromApiPrice != null && !Number.isNaN(fromApiPrice) && fromApiPrice > 0;
      const livePrice = symbol ? priceMap.get(symbol) ?? null : null;
      const currentPrice = (livePrice != null && livePrice > 0 ? livePrice : null) ?? (fromApiPriceValid ? fromApiPrice : null) ?? price;


      return {
        id,
        displayId,
        rawId,
        orderNo,
        orderno: orderNo,
        orderId: displayId,
        pair,
        base,
        quote: 'USDT',
        side,
        type,
        price,
        lotSize,
        total,
        fee,
        feeAsset: 'USDT',
        // role: 'maker',
        executedAt: createdAt ? new Date(createdAt) : new Date(),
        market,
        tp: tp ?? null,
        sl: sl ?? null,
        liquidityPrice,
        livePrice,
        currentPrice,
        expiryTimeFull
      };
    });
  }, [pendingOrdersRaw, priceMap]);

  const cancelablePendingOrders = useMemo(() => {
    if (normalizedActiveSubTab === 'all') return pendingOrders;
    return pendingOrders.filter((o) => orderMatchesSubTab(o.market, activeSubTab));
  }, [pendingOrders, normalizedActiveSubTab, activeSubTab]);

  const fetchPendingOrdersSilent = () => {
    try {
      pendingOrderWsPage.reconnect();
    } catch (err) {
      console.error("Silent refresh failed", err);
    }
  };

  const handleEditTPSL = (item, type) => {
    const resolvedLotSize =
      item?.lotsize ??
      item?.lotSize ??
      item?.volume ??
      item?.quantity ??
      item?.amount ??
      item?.raw?.lotsize ??
      item?.raw?.lot_size ??
      item?.raw?.lotSize ??
      item?.raw?.quantity ??
      item?.raw?.qty ??
      item?.raw?.size ??
      item?.raw?.volume ??
      item?.raw?.amount ??
      0;

    setSelectedPosition({
      ...item,
      type,
      volume: Number(resolvedLotSize) || 0,
      openPrice: Number(item?.openPrice ?? item?.price ?? item?.raw?.openPrice ?? item?.raw?.price ?? 0),
    });
    setTpslModalOpen(true);
  };

  const handleCloseTPSLModal = () => {
    if (tpslSaving) return;
    setTpslModalOpen(false);
    setSelectedPosition(null);
  };

  // const handleSaveTPSL = (data) => {
  //   console.log('Save TP/SL:', data);
  //   setTpslModalOpen(false);
  //   setSelectedPosition(null);
  // };

  const fetchOrdersSilent = () => {
    try {
      pendingOrderWsPage.reconnect();
      openOrderWsPage.reconnect();
    } catch (e) {
      console.error("Background sync failed", e);
    }
  };

  const handleSaveTPSL = async (data) => {
    if (!selectedPosition) return;

    const position = selectedPosition;

    const raw = position.raw ?? {};

    const pair = position.symbol || position.pair || (raw?.pairname ?? raw?.pair ?? raw?.symbol ?? '');
    const liveprice = Number(position.currentPrice ?? raw?.liveprice ?? raw?.price ?? position.openPrice ?? 0);
    const tradeprofit = data.tp;
    const stoploss = data.sl;
    const pairid = getApiPairIdByMarket(position.market, position.pairid);
    const orderno = data.orderno;

    // Basic validations
    if (!pair) {
      showError('Invalid pair for TP/SL update');
      return;
    }
    if (!Number.isFinite(liveprice) || liveprice <= 0) {
      showError('Invalid live price for TP/SL update');
      return;
    }

    const isBuy = (position.side || raw?.side || raw?.mode || 'Buy').toString().toLowerCase() === 'buy';
    // const openPrice = Number(position.openPrice ?? raw?.openPrice ?? raw?.price ?? liveprice);
    const openPrice = Number(position.openPrice ?? position.price ?? raw?.openPrice ?? raw?.price ?? liveprice);

    // -
    // if (tradeprofit != null) {
    //   if (tradeprofit <= 0) {
    //     showError('Take Profit must be greater than 0');
    //     return;
    //   }
    //   if (isBuy && tradeprofit <= openPrice) {
    //     showError('For Buy positions, Take Profit should be above entry price');
    //     return;
    //   }
    //   if (!isBuy && tradeprofit >= openPrice) {
    //     showError('For Sell positions, Take Profit should be below entry price');
    //     return;
    //   }
    // }

    // if (stoploss != null) {
    //   if (stoploss <= 0) {
    //     showError('Stop Loss must be greater than 0');
    //     return;
    //   }
    //   if (isBuy && stoploss >= openPrice) {
    //     showError('For Buy positions, Stop Loss should be below entry price');
    //     return;
    //   }
    //   if (!isBuy && stoploss <= openPrice) {
    //     showError('For Sell positions, Stop Loss should be above entry price');
    //     return;
    //   }
    // }

    const payload = {
      // trademode = trade side (buy/sell) as requested
      trademode: isBuy ? 'buy' : 'sell',
      pair,
      tradeprofit,
      stoploss,
      liveprice,
      type: getApiTypeByMarket(selectedPosition.market),
      pairid,
      orderno
    };

    setTpslSaving(true);
    try {
      await updateOrderTpSl(payload);
      showSuccess('TP/SL updated successfully');

      // Update local openPositions so UI reflects new TP/SL
      setOpenOrdersRaw((prev) =>
        prev.map((rawPos) => {
          const id = rawPos?.id ?? rawPos?.orderId ?? rawPos?.order_id ?? rawPos?.usertranid ?? rawPos?._id;
          if (id !== position.id) return rawPos;
          const updated = { ...rawPos };
          if (tradeprofit != null) {
            updated.tradeprofit = tradeprofit;
            updated.profitrade = tradeprofit;
            updated.tp = tradeprofit;
          } else {
            updated.tradeprofit = null;
            updated.profitrade = null;
            updated.tp = null;
          }
          if (stoploss != null) {
            updated.stoploss = stoploss;
            updated.sl = stoploss;
          } else {
            updated.stoploss = null;
            updated.sl = null;
          }
          return updated;
        }),
      );


      const updateRow = (prev) =>
        prev.map((rawPos) => {
          const id = rawPos?.id ?? rawPos?.orderId ?? rawPos?.order_id ?? rawPos?.usertranid ?? rawPos?._id;
          if (id !== selectedPosition.id) return rawPos;

          return {
            ...rawPos,
            tradeprofit, profitrade: tradeprofit, tp: tradeprofit,
            stoploss, sl: stoploss
          };
        });

      setOpenOrdersRaw?.(updateRow);
      setPendingOrdersRaw?.(updateRow);

      setTpslModalOpen(false);
      setSelectedPosition(null);

      fetchOrdersSilent()
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to update TP/SL';
      showError(msg, 5000);
    } finally {
      setTpslSaving(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPairDropdown(false);
        setShowTypeDropdown(false);
        setShowStatusDropdown(false);
        setShowDateDropdown(false);
      }
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(event.target)) {
        setShowColumnSettings(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Date range filtering
  const getDateRangeFilter = () => {
    const now = Date.now();
    switch (dateRange) {
      case 'today':
        return (date) => {
          const d = new Date(date);
          const today = new Date();
          return d.toDateString() === today.toDateString();
        };
      case '7d':
        return (date) => now - new Date(date).getTime() <= 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return (date) => now - new Date(date).getTime() <= 30 * 24 * 60 * 60 * 1000;
      case '90d':
        return (date) => now - new Date(date).getTime() <= 90 * 24 * 60 * 60 * 1000;
      case '1y':
        return (date) => {
          const d = new Date(date);
          const yearStart = new Date(d.getFullYear(), 0, 1);
          return d >= yearStart;
        };
      default:
        return () => true;
    }
  };

  // Enhanced filtering with date range
  const filteredData = useMemo(() => {
    let data = activeTab === 'open' ? openOrders : activeTab === 'history' ? orderHistory : pendingOrders;

    // market type filter
    if (activeSubTab !== 'all') {
      data = data.filter((item) => orderMatchesSubTab(item.market, activeSubTab));
    }

    // Date range filter
    const dateFilter = getDateRangeFilter();
    if (activeTab === 'open') {
      data = data.filter(item => dateFilter(item.createdAt));
    } else if (activeTab === 'history') {
      data = data.filter(item => dateFilter(item.createdAt));
    } else if (activeTab === 'pending') {
      data = data.filter(item => dateFilter(item.executedAt));
    }

    // Search filter - enhanced
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        (item.displayId ?? item.id).toString().toLowerCase().includes(query) ||
        item.pair.toLowerCase().includes(query) ||
        (item.price && item.price.toString().includes(query)) ||
        (item.amount && item.amount.toString().includes(query)) ||
        (item.orderId && item.orderId.toLowerCase().includes(query))
      );
    }

    // Pair filter
    if (selectedPair !== 'all') {
      data = data.filter(item => item.pair === selectedPair);
    }

    // Type filter
    if (selectedType !== 'all') {
      data = data.filter(item => item.type === selectedType);
    }

    // Status filter (for history)
    if (activeTab === 'history' && selectedStatus !== 'all') {
      data = data.filter(item => item.status === selectedStatus);
    }

    // Sort
    if (sortConfig.key) {
      data = [...data].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'date' || sortConfig.key === 'createdAt' || sortConfig.key === 'executedAt' || sortConfig.key === 'completedAt') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [activeTab, activeSubTab, searchQuery, selectedPair, selectedType, selectedStatus, dateRange, sortConfig, openOrders, orderHistory, pendingOrders]);

  const openOrderDetails = useCallback((order, sourceTab = activeTab) => {
    if (!order) return;
    setSelectedOrder({ ...order, _sourceTab: sourceTab });
    setShowOrderDetailsModal(true);
  }, [activeTab]);

  const selectedOrderLive = useMemo(() => {
    if (!selectedOrder) return null;
    const source = selectedOrder._sourceTab || activeTab;
    const sourceList =
      source === 'open'
        ? openOrders
        : source === 'pending'
          ? pendingOrders
          : orderHistory;
    if (!Array.isArray(sourceList) || sourceList.length === 0) return selectedOrder;

    const selectedId = selectedOrder.id;
    const selectedOrderNo = selectedOrder.orderNo ?? selectedOrder.orderno;
    const selectedRawId = selectedOrder.rawId;
    const selectedDisplayId = selectedOrder.displayId;

    const latest = sourceList.find((item) =>
      (selectedId != null && item?.id === selectedId) ||
      (selectedOrderNo != null && (item?.orderNo === selectedOrderNo || item?.orderno === selectedOrderNo)) ||
      (selectedRawId != null && item?.rawId === selectedRawId) ||
      (selectedDisplayId != null && item?.displayId === selectedDisplayId)
    );

    if (!latest) return selectedOrder;
    return { ...latest, _sourceTab: source };
  }, [selectedOrder, activeTab, openOrders, pendingOrders, orderHistory]);

  const selectedOrderNoLabel = useMemo(
    () => resolveOrderNo(selectedOrderLive),
    [selectedOrderLive]
  );

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // const fetchPendingOrdersSilent = async () => {
  //   try {
  //     const res = await getPendingOrders();
  //     const data = res?.data ?? res?.result ?? res ?? {};
  //     const list = Array.isArray(data) ? data : (data?.data ?? data?.list ?? []);
  //     setPendingOrdersRaw(list);
  //   } catch (err) {
  //     console.error("Silent refresh failed", err);
  //   }
  // };

  // Close share modal
  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setOrderToShare(null);
    setOrderToShareTab(null);
    setShareImageUrl(null);
  };
  const handleModalConfirm = async () => {
    if (activeTab === 'pending') {
      await handleCancelAllPendingOrders();
    } else if (activeTab === 'open') {
      await handleCancelAll();
    }
  };

  // const handleSaveTPSL = (data) => {
  //   console.log('Save TP/SL:', data);
  //   setTpslModalOpen(false);
  //   setSelectedPosition(null);
  // };

  const buildCancelPayload = (order) => {
    const side = (order.side || 'buy').toString().toLowerCase();
    const raw = order.raw ?? {};
    // Close API expects latest market price (same as OrdersPanel buildClosePayload), not entry/limit.
    const price = Number(
      order.currentPrice ??
      order.livePrice ??
      raw.liveprice ??
      raw.currentPrice ??
      raw.markPrice ??
      raw.lastPrice ??
      order.openPrice ??
      order.price ??
      0
    );
    const quantity = Number(order.amount ?? order.lotSize ?? 0);
    const pair = order.symbol || order.pair || '';
    const marketType = order.type === 'market' ? 2 : order.type === 'limit' ? 1 : 0;
    const orderno = resolveOrderNo(order) || null;
    const type = getApiTypeByMarket(order?.market);
    const lotsize = order?.lotsize ?? 0;
    const pairid = getApiPairIdByMarket(order?.market, order?.pairid);

    return { mode: side, price, quantity, pair, marketType, orderno, type, lotsize, pairid };
  };

  const handleCancelOrder = (order) => {
    // mark source (open / pending) so we know which list to update
    setOrderToCancel({ ...order, _source: activeTab });
    setShowCancelOrderModal(true);
  };

  const confirmCancelOrder = async (orderFromClick = null) => {
    // if (!orderToCancel) return;
    const targetOrder = orderFromClick || orderToCancel;

    if (!targetOrder) return;

    const payload = buildCancelPayload(targetOrder);
    if (!payload.pair || !payload.orderno) {
      showError('Invalid order data for cancellation');
      return;
    }

    const cancelId = targetOrder.orderNo || targetOrder.id;
    setCancellingIds((prev) => [...prev, cancelId]);
    try {
      if (targetOrder._source === 'pending') {
        const apiOrderType = getApiTypeByMarket(targetOrder.market || targetOrder.type);
        await cancelOrder(cancelId, apiOrderType);
        showSuccess('Pending order cancelled successfully');
        fetchPendingOrdersSilent();
      } else {
        await closeOrder(payload);
        showSuccess('Order closed successfully');
      }

      if (targetOrder._source === 'pending') {
        setPendingOrdersRaw((prev) =>
          prev.filter((raw) => {
            const rawId = raw?.id ?? raw?.orderId ?? raw?.usertranid ?? raw?._id;
            const orderNo = raw?.orderno ?? raw?.orderNo ?? null;
            return rawId !== targetOrder.rawId && orderNo !== targetOrder.orderNo;
          }),
        );
      } else {
        // default: open orders
        setOpenOrdersRaw((prev) =>
          prev.filter((raw) => {
            const rawId = raw?.id ?? raw?.orderId ?? raw?.usertranid ?? raw?._id;
            const orderNo = raw?.orderno ?? raw?.orderNo ?? null;
            return rawId !== targetOrder.rawId && orderNo !== targetOrder.orderNo;
          }),
        );
      }

      setShowCancelOrderModal(false);
      setOrderToCancel(null);
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to cancel order';
      showError(msg, 5000);
    } finally {
      setCancellingIds((prev) => prev.filter((id) => id !== cancelId));
    }
  };

  const handleCancelAll = async () => {
    if (!cancelableOpenOrders.length) {
      setShowCancelAllModal(false);
      return;
    }

    setCancellingAll(true);
    const errors = [];

    try {
      const groups = {};

      // Group orders by type only
      for (const order of cancelableOpenOrders) {
        const payload = buildCancelPayload(order);

        if (!payload.pair || !payload.orderno) continue;

        const rawType = payload.type || "";
        const typeMap = {
          crypto: "CRYPTO",
          forex: "FOREX",
          india: "INDIAN",
          indian: "INDIAN",
        };

        const type = typeMap[rawType.toLowerCase()] || "";
        const key = type;

        if (!groups[key]) {
          groups[key] = {
            type,
            items: [],
          };
        }

        const item = {
          orderno: payload.orderno,
          price: Number(payload.price),
          quantity: Number(payload.quantity),
          markettypeid: Number(payload.marketType),
          mode: payload.mode, // ✅ Pass mode inside every order
        };

        if (type === "FOREX") {
          item.pairname = payload.pair;
          item.lotsize = Number(payload.lotsize);
        } else if (type === "INDIAN") {
          item.pairname = payload.pair;
          item.pairid = payload.pairid;
          item.lotsize = Number(payload.lotsize);
        } else {
          item.pairname = payload.pair;
        }

        groups[key].items.push(item);
      }

      // Call API for each type
      for (const key of Object.keys(groups)) {
        const group = groups[key];

        const bulkPayload = {
          trademode: "close",
          type: group.type,
          ordersjson: group.items,
        };

        console.log("Bulk Payload:", bulkPayload);

        try {
          await closeAllOrders(bulkPayload);
        } catch (err) {
          console.error("Failed to cancel orders:", err);

          const backendMessage =
            err?.response?.data?.message ||
            err?.response?.data?.msg ||
            err?.message ||
            "Failed to cancel orders";

          errors.push(backendMessage);
        }
      }

      if (errors.length) {
        showError([...new Set(errors)].join("\n"), 5000);
      } else {
        showSuccess("All orders cancelled successfully");
      }

      await fetchOrdersSilent();
    } finally {
      setCancellingAll(false);
      setShowCancelAllModal(false);
    }
  };

  // const handleCancelAll = async () => {
  //   if (!cancelableOpenOrders.length) {
  //     setShowCancelAllModal(false);
  //     return;
  //   }

  //   setCancellingAll(true);
  //   let errors = [];

  //   try {
  //     /* 
  //     // PREVIOUS CODE: One by one cancellation
  //     for (const order of cancelableOpenOrders) {
  //       const payload = buildCancelPayload(order);
  //       if (!payload.pair || !payload.orderno) continue;

  //       try {
  //         await closeOrder(payload);
  //       } catch (err) {
  //         console.error('Failed to cancel order', order.id, err);

  //         const backendMessage =
  //           err?.response?.data?.message ||
  //           err?.response?.data?.msg ||
  //           err?.message ||
  //           `Order ${order.id} failed`;

  //         errors.push(backendMessage);
  //       }
  //     }
  //     */

  //     // NEW CODE: Bulk cancellation
  //     const groups = {};
  //     for (const order of cancelableOpenOrders) {
  //       const payload = buildCancelPayload(order);
  //       if (!payload.pair || !payload.orderno) continue;

  //       const rawType = payload.type || '';
  //       const typeMap = { 'crypto': 'CRYPTO', 'forex': 'FOREX', 'india': 'INDIAN', 'indian': 'INDIAN' };
  //       const type = typeMap[rawType.toLowerCase()] || '';
  //       const mode = payload.mode || '';
  //       const key = `${type}_${mode}`;

  //       if (!groups[key]) groups[key] = { type, mode, items: [], orders: [] };

  //       const item = {
  //         price: Number(payload.price),
  //         quantity: Number(payload.quantity),
  //         orderno: payload.orderno,
  //         markettypeid: payload.marketType,
  //         mode: payload.mode,
  //       };

  //       if (type === 'INDIAN') {
  //         item.pairid = payload.pairid;
  //         item.lotsize = Number(payload.lotsize);
  //       } else if (type === 'FOREX') {
  //         item.pairname = payload.pair;
  //         item.lotsize = Number(payload.lotsize);
  //       } else {
  //         item.pairname = payload.pair;
  //       }
  //       groups[key].items.push(item);
  //       groups[key].orders.push(order);
  //     }

  //     for (const groupKey of Object.keys(groups)) {
  //       const group = groups[groupKey];
  //       try {
  //         const bulkPayload = {
  //           // mode: group.mode,
  //           trademode: 'close',
  //           type: group.type,
  //           ordersjson: group.items
  //         };
  //         // console.log("bulk payload cancelAll-------", bulkPayload);
  //         await closeAllOrders(bulkPayload);
  //       } catch (err) {
  //         console.error('Failed to cancel group of orders', err);
  //         const backendMessage =
  //           err?.response?.data?.message ||
  //           err?.response?.data?.msg ||
  //           err?.message ||
  //           `Group cancel failed`;
  //         errors.push(backendMessage);
  //       }
  //     }

  //     if (errors.length > 0) {
  //       const uniqueErrors = [...new Set(errors)];
  //       showError(uniqueErrors.join("\n"), 5000);
  //     } else {
  //       showSuccess("All orders cancelled successfully");
  //     }

  //     await fetchOrdersSilent();

  //   } finally {
  //     setCancellingAll(false);
  //     setShowCancelAllModal(false);
  //   }
  // };

  // const handleCancelAll = async () => {
  //   if (!openOrders.length) {
  //     setShowCancelAllModal(false);
  //     return;
  //   }
  //   setCancellingAll(true);
  //   try {
  //     // Best-effort: cancel each open order one by one
  //     for (const order of openOrders) {
  //       const payload = buildCancelPayload(order);
  //       if (!payload.pair || !payload.orderno) continue;
  //       try {
  //         await closeOrder(payload);
  //       } catch (err) {
  //         // keep going; report generic error at end
  //         console.error('Failed to cancel order', order.id, err);
  //       }
  //     }
  //     showSuccess('Cancel all request sent for open orders');
  //     // Clear open orders locally
  //     setOpenOrdersRaw([]);
  //   } finally {
  //     setCancellingAll(false);
  //     setShowCancelAllModal(false);
  //   }
  // };

  const handleCancelPendingOrder = async (orderId, orderType) => {
    try {
      const apiOrderType = getApiTypeByMarket(orderType);

      const response = await cancelOrder(orderId, apiOrderType);

      if (response.status === 'true' || response.code === 200) {
        // triggerOrderRefresh();
        fetchPendingOrdersSilent();
        showSuccess('Pending order closed successfully');
      }
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to close position';
      showError(msg, 5000);
      triggerOrderRefresh();
    }
  };

  const handleCancelAllPendingOrders = async () => {
    if (!cancelablePendingOrders || cancelablePendingOrders.length === 0) {
      setShowCancelAllModal(false);
      return;
    }
    setCancellingAll(true);
    try {
      const allOrderNos = cancelablePendingOrders
        .map(order => order.orderNo)
        .filter(no => no != null);

      const allOrderTypes = cancelablePendingOrders
        .map(order => getApiTypeByMarket(order.market))
        .filter(type => type != null);

      const response = await cancelOrder(allOrderNos, allOrderTypes);

      if (response.status === 'true' || response.code === 200 || response.status === true) {
        triggerOrderRefresh();
        showSuccess('All pending orders cancelled successfully');
      }
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Failed to cancel orders';
      showError(msg, 5000);
    } finally {
      setCancellingAll(false);
      setShowCancelAllModal(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => {
      if (activeTab === 'open') {
        return {
          'Order ID': item.displayId ?? item.id,
          'Date/Time': formatDate(item.createdAt),
          'Pair': item.pair,
          'Type': getTypeBadge(item.type).label,
          'Side': item.side === 'buy' ? 'Buy' : 'Sell',
          'Price': item.price ? `${item.price.toFixed(2)}` : 'Market Price',
          'Amount': item.amount != null ? `${Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${item.base}` : '-',
          'Filled': item.filled != null ? `${Number(item.filled).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${item.base}${item.amount && Number(item.amount) > 0 ? ` (${((Number(item.filled || 0) / Number(item.amount)) * 100).toFixed(1)}%)` : ''}` : '-',
          'Total': item.total > 0 ? `${item.total.toFixed(2)}` : '-',
          'Filled Total': item.filledTotal > 0 ? `${item.filledTotal.toFixed(2)}` : '-',
          'Fee': `${(item.fee ?? 0).toFixed(2)} ${item.feeAsset}`,
        };
      } else if (activeTab === 'history') {
        const pnlValue = item.profit ?? 0;
        const pnlPercent = item.profitPct ?? 0;
        console.log("item", item);

        return {
          'Date/Time': formatDate(item.createdAt),
          'Order No': item.orderNo,
          'Pair': item.pair,
          'Type': getTypeBadge(item.type).label,
          'Side': item.side === 'buy' ? 'Buy' : 'Sell',
          'Price': item.price ? `${item.price.toFixed(2)}` : 'Market',
          'Lot Size': `${item.lotSize.toFixed(4)}`,
          'Fee (USDT)': `${item.fee.toFixed(2)}`,
          'Profit & Loss': `${pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
          'TP': item.tp,
          'SL': item.sl,
          // 'Order ID': item.displayId ?? item.id,
          // 'Completion Time': item.completedAt ? formatDate(item.completedAt) : '-',
          // 'Filled': `${item.filled.toFixed(4)} ${item.base} (${((item.filled / item.amount) * 100).toFixed(1)}%)`,
          // 'Average Fill Price': `$${item.avgFillPrice.toFixed(2)}`,
          // 'Total': `$${item.total.toFixed(2)}`,
          // 'Lot Size': `${item.lotSize.toFixed(4)} ${item.base}`,
          // 'Fee': `${item.fee.toFixed(2)} ${item.feeAsset}`,
          // 'Fee Rate': `${item.feeRate}% ${item.role === 'maker' ? 'Maker' : 'Taker'}`,
          // 'Status': getStatusBadge(item.status).label,
        };
      } else {
        return {
          'Trade ID': item.displayId ?? item.id,
          'Order ID': item.orderId,
          'Time': formatDate(item.executedAt),
          'Pair': item.pair,
          'Side': item.side === 'buy' ? 'Buy' : 'Sell',
          'Price': `${item.price.toFixed(2)}`,
          'Amount': `${item.amount.toFixed(4)} ${item.base}`,
          'Total': `${item.total.toFixed(2)}`,
          'Fee': `${item.fee.toFixed(2)} ${item.feeAsset}`,
          'Role': item.role === 'maker' ? 'Maker' : 'Taker',
        };
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'open' ? 'Open Orders' : activeTab === 'history' ? 'Order History' : 'Trade History');

    const fileName = `${activeTab === 'open' ? 'Open_Orders' : activeTab === 'history' ? 'Order_History' : 'Trade_History'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setShowExportDropdown(false);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Share to social media
  const handleSocialShare = async (platform) => {
    if (!shareImageUrl || !orderToShare) return;

    const text = `Check out my trade on M5dex! ${orderToShare.pair} - ${orderToShare.side === 'buy' ? 'Buy' : 'Sell'}`;
    const url = window.location.href;

    switch (platform) {
      case 'twitter':
        // Twitter sharing with image description
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        // Facebook sharing
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'whatsapp':
        // WhatsApp sharing with text and URL
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        break;
      case 'telegram':
        // Telegram sharing
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
        break;
      case 'linkedin':
        // LinkedIn sharing
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        // Copy image to clipboard
        try {
          const response = await fetch(shareImageUrl);
          const blob = await response.blob();

          if (navigator.clipboard && navigator.clipboard.write) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              // Show success feedback (you can replace with a toast notification)
              const originalTitle = document.title;
              document.title = '✓ Image copied!';
              setTimeout(() => {
                document.title = originalTitle;
              }, 2000);
            } catch (err) {
              // Fallback: copy image URL as text (works on HTTP)
              try {
                await copyToClipboard(shareImageUrl);
                alert('Image URL copied to clipboard!');
              } catch {
                alert('Copy failed. Try downloading instead.');
              }
            }
          } else {
            // Fallback for browsers that don't support Clipboard API
            const link = document.createElement('a');
            link.href = shareImageUrl;
            link.download = `ARK_Order_${orderToShare.displayId ?? orderToShare.id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert('Image download started!');
          }
        } catch (error) {
          console.error('Error copying image:', error);
          alert('Failed to copy image. Please try downloading it instead.');
        }
        break;
      default:
        break;
    }
  };

  const formatRelativeTime = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Calculate ROI for an order (works for open orders with currentPrice, and history with avgFillPrice)
  const calculateROI = (order) => {
    const directPct = Number(order?.profitPercent ?? order?.profitPct);
    const directPnl = Number(order?.profit);
    if (Number.isFinite(directPct)) {
      return {
        roi: directPct.toFixed(2),
        profit: Number.isFinite(directPnl) ? directPnl.toFixed(2) : '0.00',
        isPositive: directPct >= 0,
      };
    }

    const market = String(order?.market || '').toLowerCase();
    if (market === 'india') {
      const pnl = Number(order?.profit ?? 0);
      const pct = Number(order?.profitPercent ?? order?.profitPct ?? 0);
      if (Number.isFinite(pnl) && Number.isFinite(pct)) {
        return {
          roi: pct.toFixed(2),
          profit: pnl.toFixed(2),
          isPositive: pct >= 0,
        };
      }
    }

    const fillPrice = order.avgFillPrice ?? order.price;
    const amount = Number(order.filled ?? order.amount ?? 0);
    const currentPrice = order.currentPrice != null && order.currentPrice > 0
      ? order.currentPrice
      : (priceMap.get(order.symbol) ?? fillPrice);

    if (!fillPrice || fillPrice <= 0 || !amount) return null;
    const current = currentPrice ?? fillPrice;

    if (order.side === 'buy') {
      const roi = ((current - fillPrice) / fillPrice) * 100;
      const profit = (current - fillPrice) * amount;
      return {
        roi: roi.toFixed(2),
        profit: profit.toFixed(2),
        isPositive: roi >= 0,
      };
    } else {
      const roi = ((fillPrice - current) / fillPrice) * 100;
      const profit = (fillPrice - current) * amount;
      return {
        roi: roi.toFixed(2),
        profit: profit.toFixed(2),
        isPositive: roi >= 0,
      };
    }
  };

  // Generate share image
  const generateShareImage = async () => {
    if (!shareTemplateRef.current) return null;
    try {
      const bg =
        (typeof document !== "undefined" &&
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg-primary")
            .trim()) ||
        "#0A0E17";
      const canvas = await html2canvas(shareTemplateRef.current, {
        backgroundColor: bg,
        scale: 2,
        logging: false,
        useCORS: true,
      });

      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error generating share image:", error);
      return null;
    }
  };

  // Share order
  const handleShareOrder = async (order) => {
    setOrderToShare(order);
    setOrderToShareId(order.id);
    setOrderToShareTab(activeTab);
    setShowShareModal(true);

    // wait for DOM render
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dataUrl = await generateShareImage();
    if (dataUrl) {
      setShareImageUrl(dataUrl);
    } else {
      setShowShareModal(false);
      setOrderToShare(null);
    }
  };

  // Download share image
  const handleDownloadShare = async () => {
    if (!orderToShare) return;

    const dataUrl = await generateShareImage();

    if (!dataUrl) return;

    const link = document.createElement("a");
    link.download = `ARK_Order_${orderToShare.displayId ?? orderToShare.id}_${new Date().toISOString().split("T")[0]}.png`;
    link.href = dataUrl;
    link.click();
  };

  const orderSharedata = useMemo(() => {
    if (!orderToShareId) return null;

    return (
      filteredData.find(o => o.id === orderToShareId) ||
      openOrders.find(o => o.id === orderToShareId) ||
      orderHistory.find(o => o.id === orderToShareId) ||
      pendingOrders.find(o => o.id === orderToShareId) ||
      null
    );
  }, [orderToShareId, filteredData, openOrders, orderHistory, pendingOrders]);

  const isHistoryShare = orderToShareTab === 'history';

  const shareCurrentPrice = useMemo(() => {
    if (!orderSharedata) return null;
    if (isHistoryShare) {
      return orderSharedata.currentPrice ?? orderSharedata.avgFillPrice ?? orderSharedata.price ?? null;
    }
    return orderSharedata.currentPrice ?? priceMap.get(orderSharedata.symbol) ?? orderSharedata.avgFillPrice ?? orderSharedata.price ?? null;
  }, [orderSharedata, isHistoryShare, priceMap]);

  const roiData = useMemo(() => {
    if (!orderSharedata) return null;
    if (isHistoryShare) {
      const pct = Number(orderSharedata?.profitPct ?? orderSharedata?.profitPercent ?? 0);
      const pnl = Number(orderSharedata?.profit ?? 0);
      if (!Number.isFinite(pct) || !Number.isFinite(pnl)) return null;
      return {
        roi: pct.toFixed(2),
        profit: pnl.toFixed(2),
        isPositive: pct >= 0,
      };
    }
    return calculateROI(orderSharedata);
  }, [orderSharedata, isHistoryShare]);

  const openOrdersCount = openOrders.length;
  const pendingOrdersCount = pendingOrders.length;
  const cancelAllCount = activeTab === 'pending' ? cancelablePendingOrders.length : cancelableOpenOrders.length;

  return (
    <>
      <Header />
      <div className="orders-page">

        {/* Header */}
        {/* <div className="orders-header">
          <div className="orders-header-left">
            <button
              className="back-button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="orders-title">Orders</h1>
          </div>
        </div> */}

        <div className='card_bg'>
          {/* Navigation Tabs */}
          <div className="orders-tabs">
            <button
              className={`orders-tab ${activeTab === 'open' ? 'active' : ''}`}
              onClick={() => setActiveTab('open')}
            >
              Open Orders
              {openOrdersCount > 0 && (
                <span className="tab-badge">{openOrdersCount}</span>
              )}
            </button>
            <button
              className={`orders-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Orders
              {pendingOrdersCount > 0 && (
                <span className="tab-badge">{pendingOrdersCount}</span>
              )}
              {/* Trade History */}
            </button>
            <button
              className={`orders-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Order History
            </button>
          </div>
          {/* sub tabs */}
          <div className='order-header'>
            {/* Sub-tabs for Open Orders */}
            {/* {activeTab === 'open' && ( */}
            {(activeTab === 'open' || activeTab === 'pending' || activeTab === 'history') && (
              <div className="orders-sub-tabs">
                <button
                  className={`orders-sub-tab ${activeSubTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('all')}
                >
                  ALL
                  {/* Spot Orders */}
                </button>
                <button
                  className={`orders-sub-tab ${activeSubTab === 'crypto' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('crypto')}
                >
                  Crypto
                  {/* Margin Orders */}
                </button>
                <button
                  className={`orders-sub-tab ${activeSubTab === 'forex' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('forex')}
                >
                  Forex
                  {/* Futures Orders */}
                </button>
                <button
                  className={`orders-sub-tab ${activeSubTab === 'india' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('india')}
                >
                  Indian Market
                  {/* Trade Orders */}
                </button>
              </div>
            )}
            <div className="market-flex">
              {isIndiaTabSelected && (
                <div className="orders-pnl-currency-toggle" role="group" aria-label="Indian market P&L currency">
                  <button
                    type="button"
                    className={`orders-pnl-currency-btn ${indiaPnlCurrency === 'usdt' ? 'active' : ''}`}
                    onClick={() => setIndiaPnlCurrency('usdt')}
                  >
                    P&amp;L USDT
                  </button>
                  <button
                    type="button"
                    className={`orders-pnl-currency-btn ${indiaPnlCurrency === 'inr' ? 'active' : ''}`}
                    onClick={() => setIndiaPnlCurrency('inr')}
                    title={`1 USDT = ${inrPerUsdt.toFixed(2)} INR`}
                  >
                    P&amp;L INR
                  </button>
                </div>
              )}
              <div className="filter-search">

                <svg xmlns="http://www.w3.org/2000/svg" className="search-icon" width="29" height="29" viewBox="0 0 29 29" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by Pair..."
                  // placeholder="Search by order ID, pair, or price..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Filters and Search Bar */}
          <div className="orders-filters">

            <div className="filter-buttons">
              {/* Comment Pair filter dropdown */}
              {/* <div className="filter-dropdown-wrapper">
              <button
                className="filter-button"
                onClick={() => {
                  setShowPairDropdown(!showPairDropdown);
                  setShowTypeDropdown(false);
                  setShowStatusDropdown(false);
                  setShowDateDropdown(false);
                }}
              >
                {selectedPair === 'all' ? 'All Pairs' : selectedPair}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {showPairDropdown && (
                <div className="filter-dropdown">
                  <button
                    className={`dropdown-item ${selectedPair === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPair('all');
                      setShowPairDropdown(false);
                    }}
                  >
                    All Pairs
                  </button>
                  {tradingPairs.map(pair => (
                    <button
                      key={pair.symbol}
                      className={`dropdown-item ${selectedPair === pair.symbol ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedPair(pair.symbol);
                        setShowPairDropdown(false);
                      }}
                    >
                      <span className="pair-icon">{pair.icon}</span>
                      {pair.symbol}
                    </button>
                  ))}
                </div>
              )}
            </div> */}

              <div className="filter-dropdown-wrapper">
                <button
                  className="filter-button filter_select"
                  onClick={() => {
                    setShowTypeDropdown(!showTypeDropdown);
                    setShowPairDropdown(false);
                    setShowStatusDropdown(false);
                    setShowDateDropdown(false);
                  }}
                >
                  {orderTypes.find(t => t.id === selectedType)?.label || 'All Types'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {showTypeDropdown && (
                  <div className="filter-dropdown">
                    {orderTypes.map(type => (
                      <button
                        key={type.id}
                        className={`dropdown-item ${selectedType === type.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedType(type.id);
                          setShowTypeDropdown(false);
                        }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment status dropdown */}
              {/* {activeTab === 'history' && (
              <div className="filter-dropdown-wrapper">
                <button
                  className="filter-button"
                  onClick={() => {
                    setShowStatusDropdown(!showStatusDropdown);
                    setShowPairDropdown(false);
                    setShowTypeDropdown(false);
                    setShowDateDropdown(false);
                  }}
                >
                  {statusOptions.find(s => s.id === selectedStatus)?.label || 'All Status'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {showStatusDropdown && (
                  <div className="filter-dropdown">
                    {statusOptions.map(status => (
                      <button
                        key={status.id}
                        className={`dropdown-item ${selectedStatus === status.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedStatus(status.id);
                          setShowStatusDropdown(false);
                        }}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )} */}

              {/* comment date range filter */}
              {/* <div className="filter-dropdown-wrapper">
              <button
                className="filter-button"
                onClick={() => {
                  setShowDateDropdown(!showDateDropdown);
                  setShowPairDropdown(false);
                  setShowTypeDropdown(false);
                  setShowStatusDropdown(false);
                }}
              >
                {dateRanges.find(d => d.id === dateRange)?.label || 'Last 7 days'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {showDateDropdown && (
                <div className="filter-dropdown">
                  {dateRanges.map(range => (
                    <button
                      key={range.id}
                      className={`dropdown-item ${dateRange === range.id ? 'active' : ''}`}
                      onClick={() => {
                        setDateRange(range.id);
                        setShowDateDropdown(false);
                      }}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div> */}
            </div>

            <div className="filter-actions">
              {/* <div className="filter-dropdown-wrapper" ref={columnSettingsRef}>
              <button
                className={`settings-button ${showColumnSettings ? 'active' : ''}`}
                onClick={() => {
                  setShowColumnSettings(!showColumnSettings);
                  setShowExportDropdown(false);
                }}
                title="Column Settings"
                aria-label="Show/Hide Columns"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3" />
                </svg>
              </button>
              {showColumnSettings && (
                <div className="column-settings-dropdown">
                  <div className="column-settings-header">
                    <h3>Show/Hide Columns</h3>
                    <button
                      className="reset-columns-button"
                      onClick={() => {
                        // Reset to default
                        setVisibleColumns({
                          open: {
                            dateTime: true, pair: true, type: false, side: true, price: true, liquidityPrice: false,
                            lotSize: true, filled: false, total: false, currentPrice: true, tpsl: true, pnl: true,
                            actions: true,
                          },
                          history: {
                            dateTime: true, pair: true, type: true, side: true, price: true,
                            lotSize: true, fee: true, pnl: true, actions: true,
                            // tpsl: true,
                          },
                          pending: {
                            time: true, pair: true, side: true, price: true, lotSize: true, liquidityPrice: true, tpsl: true,
                            total: true, fee: true, feeAsset: true, role: true, orderId: true, actions: true
                          },
                        });
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="column-settings-list">
                    {activeTab === 'open' && Object.entries({
                      dateTime: 'Date/Time',
                      pair: 'Pair',
                      side: 'Side',
                      price: 'Price',
                      lotSize: 'Lot Size',
                      tpsl: 'TP/SL',
                      currentPrice: 'Current Price',
                      pnl: 'P&L',
                      actions: 'Actions',
                    }).map(([key, label]) => (
                      <label key={key} className="column-checkbox">
                        <input
                          type="checkbox"
                          checked={visibleColumns.open[key]}
                          onChange={(e) => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              open: { ...prev.open, [key]: e.target.checked },
                            }));
                          }}
                        />
                        {label}
                      </label>
                    ))}
                    {activeTab === 'history' && Object.entries({
                      dateTime: 'Date/Time',
                      pair: 'Pair',
                      type: 'Type',
                      side: 'Side',
                      price: 'Price',
                      lotSize: 'Lot Size',
                      // tpsl: 'TP/SL',
                      // filled: 'Filled',
                      // avgFillPrice: 'Avg Fill Price',
                      // completionTime: 'Completion Time',
                      fee: 'Fee',
                      pnl: 'P&L',
                      // status: 'Status',
                      actions: 'Actions',
                    }).map(([key, label]) => (
                      <label key={key} className="column-checkbox">
                        <input
                          type="checkbox"
                          checked={visibleColumns.history[key]}
                          onChange={(e) => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              history: { ...prev.history, [key]: e.target.checked },
                            }));
                          }}
                        />
                        {label}
                      </label>
                    ))}
                    {activeTab === 'pending' && Object.entries({
                      time: 'Time',
                      pair: 'Pair',
                      side: 'Side',
                      type: 'Type',
                      price: 'Price',
                      lotSize: 'Lot Size',
                      liquidityPrice: 'Liquidity Price',
                      tpsl: 'TP/SL',
                      total: 'Total',
                      fee: 'Fee',
                      actions: 'Actions',
                      // feeAsset: 'Fee Asset',
                      // role: 'Role',
                      // orderId: 'Order ID',
                      // orderno: 'Order No',
                    }).map(([key, label]) => (
                      <label key={key} className="column-checkbox">
                        <input
                          type="checkbox"
                          checked={visibleColumns.pending[key]}
                          onChange={(e) => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              pending: { ...prev.pending, [key]: e.target.checked },
                            }));
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div> */}
              {/* show export button only history tab. */}
              {activeTab === 'history' && (
                <div className="filter-dropdown-wrapper" ref={exportDropdownRef}>
                  <button
                    className={`export-button ${filteredData.length === 0 ? 'disabled' : ''}`}
                    onClick={() => {
                      if (filteredData.length === 0) return;
                      setShowExportDropdown(!showExportDropdown);
                      setShowColumnSettings(false);
                    }}
                    disabled={filteredData.length === 0}
                    title={filteredData.length === 0 ? 'No data to export' : 'Export data'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {showExportDropdown && filteredData.length > 0 && (
                    <div className="filter-dropdown">
                      <button className="dropdown-item" onClick={handleExportExcel}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export as Excel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'open' && (
                <button
                  className="cancel-all-button"
                  onClick={() => setShowCancelAllModal(true)}
                >
                  {/* Cancel All Orders */}
                  Close All Orders
                </button>
              )}

              {activeTab === 'pending' && (
                <button
                  className="cancel-all-button"
                  onClick={() => setShowCancelAllModal(true)}
                >
                  Cancel All Orders
                </button>
              )}
            </div>
          </div>
        </div>

        <div className='card_bg'>
          {/* Orders Table */}
          <div className="orders-table-container">
            {activeTab === 'open' && openOrdersForPnLBar.length > 0 && (
              <div className={`orders-total-pnl-bar ${openOrdersTotalPnL.isProfit ? 'orders-total-pnl--profit' : 'orders-total-pnl--loss'}`}>
                <span className="orders-total-pnl-label">TOTAL P&L</span>
                <span className="orders-total-pnl-value">
                  {openOrdersTotalPnlDisplay.text}
                  <span className="orders-total-pnl-pct">
                    ({openOrdersTotalPnL.totalPnLPercent >= 0 ? '+' : ''}{Number(openOrdersTotalPnL.totalPnLPercent).toFixed(2)}%)
                  </span>
                </span>
              </div>
            )}
            {activeTab === 'open' && openOrdersLoading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <h3>Loading open orders…</h3>
              </div>
            ) : activeTab === 'open' && openOrdersError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠</div>
                <h3>Failed to load</h3>
                <p>{openOrdersError}</p>
              </div>
            ) : activeTab === 'history' && orderHistoryLoading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <h3>Loading order history…</h3>
              </div>
            ) : activeTab === 'history' && orderHistoryError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠</div>
                <h3>Failed to load</h3>
                <p>{orderHistoryError}</p>
              </div>
            ) : activeTab === 'pending' && pendingOrdersLoading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <h3>Loading trade history…</h3>
              </div>
            ) : activeTab === 'pending' && pendingOrdersError ? (
              <div className="empty-state">
                <div className="empty-icon">⚠</div>
                <h3>Failed to load</h3>
                <p>{pendingOrdersError}</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No {activeTab === 'open' ? 'open' : activeTab === 'history' ? 'historical' : 'trade'} orders</h3>
                <p>
                  {activeTab === 'open'
                    ? "You don't have any active orders. Place your first order to start trading!"
                    : "No orders match your filters. Try adjusting your search criteria."}
                </p>
                {activeTab === 'open' && (
                  <button className="go-to-trading-button" onClick={() => navigate(-1)}>
                    Go to Trading
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="orders-table-wrapper">
                  <div className='table-responsive'>
                    <table className="orders-table">
                      <thead>
                        <tr>
                          {activeTab === 'open' && (
                            <>
                              {visibleColumns.open.pair && (
                                <th onClick={() => handleSort('pair')} className="sortable">
                                  Pair
                                  {sortConfig.key === 'pair' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {visibleColumns.open.dateTime && (
                                <th onClick={() => handleSort('createdAt')} className="sortable">
                                  Date/Time
                                  {sortConfig.key === 'createdAt' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {/* {visibleColumns.open.type && (
                              <th onClick={() => handleSort('type')} className="sortable">
                                Type
                                {sortConfig.key === 'type' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {visibleColumns.open.side && (
                                <th onClick={() => handleSort('side')} className="sortable">
                                  Side
                                  {sortConfig.key === 'side' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {visibleColumns.open.price && (
                                <th onClick={() => handleSort('price')} className="sortable">
                                  Price
                                  {sortConfig.key === 'price' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {/* {visibleColumns.open.liquidityPrice && (
                              <th onClick={() => handleSort('liquidityPrice')} className="sortable">
                                Liquidity Price
                                {sortConfig.key === 'liquidityPrice' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {visibleColumns.open.lotSize && (
                                <th onClick={() => handleSort('lotSize')} className="sortable">
                                  Size
                                  {sortConfig.key === 'lotSize' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {/* {visibleColumns.open.filled && (
                              <th onClick={() => handleSort('filled')} className="sortable">
                                Filled
                                {sortConfig.key === 'filled' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {/* {visibleColumns.open.total && (
                              <th onClick={() => handleSort('total')} className="sortable">
                                Total
                                {sortConfig.key === 'total' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {visibleColumns.open.currentPrice && (
                                <th>Current Price
                                  {/* <span className="live-badge">LIVE</span> */}
                                </th>
                              )}
                              {visibleColumns.history.tpsl && <th>TP/SL</th>}
                              {visibleColumns.open.pnl && (
                                <th onClick={() => handleSort('profit')} className="sortable">
                                  P&L
                                  {/* <span className="live-badge">LIVE</span> */}
                                  {sortConfig.key === 'profit' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {visibleColumns.open.actions && <th>Actions</th>}
                            </>
                          )}
                          {activeTab === 'history' && (
                            <>
                              {visibleColumns.history.pair && <th>Pair</th>}
                              {visibleColumns.history.dateTime && (
                                <th onClick={() => handleSort('createdAt')} className="sortable">
                                  Date/Time
                                  {sortConfig.key === 'createdAt' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {/* {visibleColumns.history.type && <th>Type</th>} */}
                              {visibleColumns.history.side && <th>Side</th>}
                              {visibleColumns.history.price && <th>Price</th>}
                              {visibleColumns.history.lotSize && <th>Size</th>}
                              {visibleColumns.open.tpsl && <th>TP/SL</th>}
                              {/* {visibleColumns.history.filled && <th>Filled</th>} */}
                              {/* {visibleColumns.history.avgFillPrice && <th>Avg Fill Price</th>} */}
                              {/* {visibleColumns.history.completionTime && (
                              <th onClick={() => handleSort('completedAt')} className="sortable">
                                Completion Time
                                {sortConfig.key === 'completedAt' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {visibleColumns.history.fee && <th>Fee (USDT)</th>}
                              {visibleColumns.history.pnl && <th>P&L</th>}
                              {/* {visibleColumns.history.status && <th>Status</th>} */}
                              {/* {visibleColumns.history.actions && <th>Actions</th>} */}
                            </>
                          )}
                          {activeTab === 'pending' && (
                            <>
                              {visibleColumns.pending.pair && <th>Pair</th>}
                              {visibleColumns.pending.time && (
                                <th onClick={() => handleSort('executedAt')} className="sortable">
                                  Time
                                  {sortConfig.key === 'executedAt' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                  )}
                                </th>
                              )}
                              {visibleColumns.pending.side && <th>Side</th>}
                              {visibleColumns.pending.type && <th>Type</th>}
                              {visibleColumns.pending.price && <th>Price</th>}
                              {visibleColumns.pending.lotSize && <th>Lot Size</th>}
                              {/* {visibleColumns.pending.liquidityPrice && (
                              <th onClick={() => handleSort('liquidityPrice')} className="sortable">
                                Liquidity Price
                                {sortConfig.key === 'liquidityPrice' && (
                                  <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            )} */}
                              {visibleColumns.open.tpsl && <th>TP/SL</th>}
                              {visibleColumns.pending.total && <th>Total</th>}
                              {visibleColumns.pending.fee && <th>Fee (USDT)</th>}
                              {visibleColumns.pending.actions && <th>Actions</th>}
                              {/* {visibleColumns.pending.feeAsset && <th>Fee Asset</th>} */}
                              {/* {visibleColumns.pending.role && <th>Role</th>} */}
                              {/* {visibleColumns.pending.orderno && <th>Order No</th>} */}
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Row click opens order details modal */}
                        {paginatedData.map((item) => {
                          return (
                            <tr
                              key={item.id}
                              className="table-row"
                              onClick={() => openOrderDetails(item, activeTab)}
                            >

                              {activeTab === 'open' && (
                                <>
                                  {visibleColumns.open.pair && (
                                    <td>
                                      <div className="pair-cell">
                                        {item.pair}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.open.dateTime && (
                                    <td>
                                      <div className="date-cell">
                                        {formatDate(item.createdAt)}
                                        <span className="relative-time">{formatRelativeTime(item.createdAt)}</span>
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.open.side && (
                                    <td>
                                      <span className={`side-badge ${item.side === 'buy' ? 'buy' : 'sell'}`}>
                                        {item.side === 'buy' ? '⬆ Buy' : '⬇ Sell'}
                                      </span>
                                    </td>
                                  )}
                                  {visibleColumns.open.price && (
                                    <td className="price-cell">
                                      {item.price ? formatPriceUtil(item.price) : 'Market Price'}
                                    </td>
                                  )}
                                  {visibleColumns.open.lotSize && (
                                    <td className="amount-cell">
                                      <div className="amount-primary">
                                        {item?.lotsize || item?.lotSize}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.open.currentPrice && (
                                    <td className="price-cell">
                                      {item.currentPrice != null ? formatPriceUtil(item.currentPrice) : '-'}
                                    </td>
                                  )}
                                  {visibleColumns.open.tpsl && (
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div className="tpsl-cell-inline">
                                        <span>TP: {item.tp != null && item.tp !== '' ? Number(item.tp).toFixed(2) : '0'}</span>
                                        <span>SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? Number(item.sl).toFixed(2) : '0'}</span>
                                        <button
                                          type="button"
                                          className="tpsl-edit-btn-inline"
                                          onClick={(e) => { e.stopPropagation(); handleEditTPSL(item, item.type); }}
                                          title="Edit TP/SL"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.open.pnl && (
                                    <td className={`pnl-cell ${(item.profit || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                                      <span className={(item.profit || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                                        {formatPnlCurrency(item.profit || 0, item.market).text}
                                      </span>
                                      <span className={`pnl-pct ${(item.profitPercent || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{(item.profitPercent || 0) >= 0 ? '+' : ''}{Number(item.profitPercent || 0).toFixed(2)}%</span>
                                    </td>
                                  )}
                                  {visibleColumns.open.actions && (
                                    <td>
                                      <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          className="cancel-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelOrder(item);
                                          }}
                                          disabled={cancellingIds.includes(item.id)}
                                          aria-label={activeTab === "open" ? "Close" : "Cancel"}
                                        >
                                          {cancellingIds.includes(item.id)
                                            ? activeTab === "open"
                                              ? "Closing..."
                                              : "Cancelling..."
                                            : activeTab === "open"
                                              ? "Close"
                                              : "Cancel"}
                                        </button>
                                        <button
                                          className="share-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleShareOrder(item);
                                          }}
                                          aria-label="Share order"
                                          title="Share order"
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="18" cy="5" r="3" />
                                            <circle cx="6" cy="12" r="3" />
                                            <circle cx="18" cy="19" r="3" />
                                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                          </svg>
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                              {activeTab === 'history' && (
                                <>
                                  {visibleColumns.history.pair && (
                                    <td>
                                      <div className="pair-cell">
                                        {item.pair}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.history.dateTime && (
                                    <td>
                                      <div className="date-cell">
                                        {formatDate(item.createdAt)}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.history.side && (
                                    <td>
                                      <span className={`side-badge ${item.side === 'buy' ? 'buy' : 'sell'}`}>
                                        {item.side === 'buy' ? '⬆ Buy' : '⬇ Sell'}
                                      </span>
                                    </td>
                                  )}
                                  {visibleColumns.history.price && (
                                    <td className="price-cell">
                                      {item.price ? formatPriceUtil(item.price) : '0.00'}
                                    </td>
                                  )}
                                  {visibleColumns.history.lotSize && (
                                    <td className="amount-cell">
                                      {item?.lotsize || item?.lotSize ? `${Number(item?.lotsize || item?.lotSize).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                    </td>
                                  )}
                                  {visibleColumns.history.tpsl && (
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div className="tpsl-cell-inline">
                                        <span>TP: {item.tp != null && item.tp !== '' ? Number(item.tp).toFixed(2) : '0'}</span>
                                        <span>SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? Number(item.sl).toFixed(2) : '0'}</span>
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.history.fee && (
                                    <td>
                                      <div className="fee-cell">
                                        {item.fee.toFixed(2)}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.history.pnl && (
                                    <td>
                                      <span className={item.profit >= 0 ? 'profitPositive' : 'profitNegative'}>
                                        {formatPnlCurrency(item.profit || 0, item.market).text}
                                      </span>
                                      {Number.isFinite(Number(item.profitPct)) && Number(item.profitPct) !== 0 ? (
                                        <span className={`profitPercent ${Number(item.profitPct) >= 0 ? 'profitPositive' : 'profitNegative'}`}>
                                          {Number(item.profitPct) >= 0 ? '+' : ''}{Number(item.profitPct).toFixed(2)}%
                                        </span>
                                      ) : null}
                                    </td>
                                  )}
                                </>
                              )}
                              {activeTab === 'pending' && (
                                <>
                                  {visibleColumns.pending.pair && (
                                    <td>
                                      <div className="pair-cell">
                                        {item.pair}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.pending.time && (
                                    <td>
                                      <div className="date-cell">
                                        {formatDate(item.executedAt)}
                                        <span className="relative-time">{formatRelativeTime(item.executedAt)}</span>
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.pending.side && (
                                    <td>
                                      <span className={`side-badge ${item.side === 'buy' ? 'buy' : 'sell'}`}>
                                        {item.side === 'buy' ? '⬆ Buy' : '⬇ Sell'}
                                      </span>
                                    </td>
                                  )}
                                  {visibleColumns.pending.type && (
                                    <td>
                                      <span className={`type-badge ${getTypeBadge(item.type).color}`}>
                                        {getTypeBadge(item.type).label}
                                      </span>
                                    </td>
                                  )}
                                  {visibleColumns.pending.price && (
                                    <td className="price-cell">
                                      {formatPriceUtil(item.price || 0)}
                                    </td>
                                  )}
                                  {visibleColumns.pending.lotSize && (
                                    <td className="amount-cell">
                                      {item.lotSize.toFixed(4)}
                                    </td>
                                  )}
                                  {visibleColumns.pending.tpsl && (
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div className="tpsl-cell-inline">
                                        <span>TP: {item.tp != null && item.tp !== '' ? Number(item.tp).toFixed(2) : '0'}</span>
                                        <span>SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? Number(item.sl).toFixed(2) : '0'}</span>
                                        <button
                                          type="button"
                                          className="tpsl-edit-btn-inline"
                                          onClick={(e) => { e.stopPropagation(); handleEditTPSL(item, item.type); }}
                                          title="Edit TP/SL"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.pending.total && (
                                    <td className="total-cell">
                                      {item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  )}
                                  {visibleColumns.pending.fee && (
                                    <td>
                                      <div className="fee-cell">
                                        {item.fee.toFixed(2)}
                                      </div>
                                    </td>
                                  )}
                                  {visibleColumns.pending.actions && (
                                    <td>
                                      <div className="action-buttons" onClick={(e) => e.stopPropagation()}>

                                        <button
                                          className="cancel-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelOrder(item);
                                          }}
                                          disabled={cancellingIds.includes(item.orderNo || item.id)}
                                          aria-label="Cancel"
                                        >
                                          {cancellingIds.includes(item.orderNo || item.id) ? 'Cancelling…' : 'Cancel'}
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Mobile Card View */}
                <div className="orders-card-view">
                  {paginatedData.map((item) => (
                    <div
                      key={item.id}
                      className="orders-card-item"
                      onClick={() => openOrderDetails(item, activeTab)}
                    >
                      <div className="orders-card-header">
                        <div className="orders-card-main-info">
                          <div className="orders-card-pair">
                            {item.pair}
                          </div>
                        </div>
                        <div className="orders-card-badges">
                          <span className={`side-badge ${item.side === 'buy' ? 'buy' : 'sell'}`}>
                            {item.side === 'buy' ? '⬆ Buy' : '⬇ Sell'}
                          </span>
                          {activeTab === 'open' && (
                            <span className={`status-badge ${getStatusBadge(item.status).color}`}>
                              {getStatusBadge(item.status).icon} {getStatusBadge(item.status).label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="orders-card-body">
                        {activeTab === 'open' && (
                          <>
                            {visibleColumns.open.dateTime && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Date/Time</span>
                                <span className="orders-card-value">
                                  {formatDate(item.createdAt)} ({formatRelativeTime(item.createdAt)})
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.type && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Type</span>
                                <span className="orders-card-value">
                                  <span className={`type-badge ${getTypeBadge(item.type).color}`}>
                                    {getTypeBadge(item.type).label}
                                  </span>
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.price && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Price</span>
                                <span className="orders-card-value">
                                  {item.price ? formatPriceUtil(item.price) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.liquidityPrice && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Liquidity Price</span>
                                <span className="orders-card-value">
                                  {item.liquidityPrice ? formatPriceUtil(item.liquidityPrice) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.lotSize && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">lotSize</span>
                                <span className="orders-card-value">
                                  {item.lotsize.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.currentPrice && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Current Price
                                </span>
                                <span className="orders-card-value">
                                  {item.currentPrice != null ? formatPriceUtil(item.currentPrice) : '-'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.tpsl && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">TP/SL</span>
                                <span className="orders-card-value">
                                  <div className="tpsl-mobile-wrapper">
                                    <span>
                                      TP: {item.tp != null && item.tp !== '' ? formatPriceUtil(item.tp) : '0'} |
                                      SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? formatPriceUtil(item.sl) : '0'}
                                    </span>
                                    <button
                                      type="button"
                                      className="tpsl-edit-btn-inline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTPSL(item);
                                      }}
                                      style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.pnl && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">P&L
                                </span>
                                <span className="orders-card-value">
                                  <div style={{ display: 'flex', flexDirection: 'column', }}>
                                    <span className={(item.profit || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontWeight: '600' }}>
                                      {formatPnlCurrency(item.profit || 0, item.market).text}
                                    </span>
                                    <span className={`pnl-pct ${(item.profitPercent || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}`} style={{ fontSize: '12px' }}>
                                      {(item.profitPercent || 0) >= 0 ? '+' : ''}{Number(item.profitPercent || 0).toFixed(2)}%
                                    </span>
                                  </div>
                                </span>
                              </div>
                            )}
                            {visibleColumns.open.total && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Total</span>
                                <span className="orders-card-value">
                                  {item.total > 0 ? formatPriceUtil(item.total) : '-'}
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        {activeTab === 'history' && (
                          <>
                            {visibleColumns.history.dateTime && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Date</span>
                                <span className="orders-card-value">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.type && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Type</span>
                                <span className="orders-card-value">
                                  <span className={`type-badge ${getTypeBadge(item.type).color}`}>
                                    {getTypeBadge(item.type).label}
                                  </span>
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.price && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Price</span>
                                <span className="orders-card-value">
                                  {item.price ? formatPriceUtil(item.price) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.amount && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Amount</span>
                                <span className="orders-card-value">
                                  {formatPriceUtil(item.amount || 0)} {item.base}
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.tpsl && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">TP/SL</span>
                                <span className="orders-card-value">
                                  <div className="tpsl-mobile-wrapper">
                                    <span>
                                      TP: {item.tp != null && item.tp !== '' ? Number(item.tp).toFixed(2) : '0'} |
                                      SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? Number(item.sl).toFixed(2) : '0'}
                                    </span>
                                  </div>
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.avgFillPrice && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Avg Fill</span>
                                <span className="orders-card-value">
                                  {item.avgFillPrice ? formatPriceUtil(item.avgFillPrice) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.history.fee && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Fee</span>
                                <span className="orders-card-value">
                                  {formatPriceUtil(item.fee || 0)} {item.feeAsset}
                                </span>
                              </div>
                            )}
                            {/* {visibleColumns.history.status && (
                            <div className="orders-card-field">
                              <span className="orders-card-label">Status</span>
                              <span className="orders-card-value">
                                <span className={`status-badge ${getStatusBadge(item.status).color}`}>
                                  {getStatusBadge(item.status).icon} {getStatusBadge(item.status).label}
                                </span>
                              </span>
                            </div>
                          )} */}
                          </>
                        )}

                        {activeTab === 'pending' && (
                          <>
                            {visibleColumns.pending.time && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Time</span>
                                <span className="orders-card-value">
                                  {formatRelativeTime(item.executedAt)}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.price && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Price</span>
                                <span className="orders-card-value">
                                  {item.price ? formatPriceUtil(item.price) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.lotSize && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Lot Size</span>
                                <span className="orders-card-value">
                                  {formatPriceUtil(item.lotSize || 0)} {item.base}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.liquidityPrice && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Liquidity Price</span>
                                <span className="orders-card-value">
                                  {item.liquidityPrice ? formatPriceUtil(item.liquidityPrice) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.tpsl && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">TP/SL</span>
                                <span className="orders-card-value">
                                  <div className="tpsl-mobile-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>
                                      TP: {item.tp != null && item.tp !== '' ? formatPriceUtil(item.tp) : '0'} |
                                      SL: {item.sl != null && item.sl !== '' && item.sl !== 0 ? formatPriceUtil(item.sl) : '0'}
                                    </span>
                                    <button
                                      type="button"
                                      className="tpsl-edit-btn-inline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTPSL(item);
                                      }}
                                      style={{ padding: '2px 8px', fontSize: '12px' }}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.total && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Total</span>
                                <span className="orders-card-value">
                                  {item.total ? formatPriceUtil(item.total) : '0.00'}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.fee && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Fee</span>
                                <span className="orders-card-value">
                                  {formatPriceUtil(item.fee || 0)} {item.feeAsset}
                                </span>
                              </div>
                            )}
                            {visibleColumns.pending.role && (
                              <div className="orders-card-field">
                                <span className="orders-card-label">Role</span>
                                <span className="orders-card-value">
                                  <span className={`role-badge ${item.role === 'maker' ? 'maker' : 'taker'}`}>
                                    {item.role === 'maker' ? 'M' : 'T'}
                                  </span>
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="orders-card-actions" onClick={(e) => e.stopPropagation()}>
                        {activeTab === 'open' && visibleColumns.open.actions && (
                          <>
                            <button
                              className="share-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareOrder(item);
                              }}
                              aria-label="Share order"
                              title="Share order"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            </button>
                            <button
                              className="cancel-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelOrder(item);
                              }}
                              aria-label="Cancel order"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {activeTab === 'history' && visibleColumns.history.actions && (
                          <>
                            <button
                              className="share-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareOrder(item);
                              }}
                              aria-label="Share order"
                              title="Share order"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            </button>
                            <button
                              className="view-details-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOrderDetails(item, 'history');
                              }}
                            >
                              Details
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} orders
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="pagination-button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
              <CustomSelect
                className="items-per-page-select"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </CustomSelect>
            </div>
          )}
        </div>

        {/* Cancel Order Confirmation Modal */}
        {showCancelOrderModal && orderToCancel && (
          <div className="modal-overlay" onClick={() => setShowCancelOrderModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{orderToCancel._source === 'open' ? 'Close Order?' : 'Cancel Order?'}</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowCancelOrderModal(false);
                    setOrderToCancel(null);
                  }}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p>You are about to {orderToCancel._source === 'open' ? 'close' : 'cancel'} this order:</p>
                <div className="cancel-order-details">
                  {/* <div><strong>Order No:</strong> {orderToCancel.orderNo ?? orderToCancel.orderNo}</div> */}
                  <div><strong>Pair:</strong> {orderToCancel.pair}</div>
                  <div><strong>Type:</strong> {getTypeBadge(orderToCancel.type).label} </div>
                  <div><strong>Side:</strong> {orderToCancel.side === 'buy' ? 'Buy' : 'Sell'}</div>
                  <div><strong>Size:</strong> {orderToCancel?.lotsize || orderToCancel?.lotSize ? `${Number(orderToCancel?.lotsize || orderToCancel?.lotSize).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}</div>
                  <div><strong>Entry Price:</strong> {orderToCancel.price ? `${Number(orderToCancel.price).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}` : 'Market Price'}</div>
                  <div><strong>Current Price:</strong> {orderToCancel.currentPrice != null ? `${Number(orderToCancel.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}` : '-'}</div>
                </div>
                <p className="warning-text">This action cannot be undone</p>
                <div className="modal_btn">
                  <button
                    className="modal-button keep_order"
                    onClick={() => {
                      setShowCancelOrderModal(false);
                      setOrderToCancel(null);
                    }}
                  >
                    Keep Order
                  </button>
                  <button
                    className="modal-button primary danger"
                    onClick={() => {
                      confirmCancelOrder();
                    }}
                    disabled={cancellingIds.includes(orderToCancel.id)}
                  >
                    {cancellingIds.includes(orderToCancel.id) ? (orderToCancel._source === 'open' ? 'Closing…' : 'Cancelling…') : (orderToCancel._source === 'open' ? 'Close Order' : 'Cancel Order')}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Cancel All Modal */}
        {showCancelAllModal && (
          <div className="modal-overlay" onClick={() => setShowCancelAllModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Cancel All Orders?</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowCancelAllModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p>
                  You are about to {activeTab === 'pending' ? 'cancel' : 'close'}{' '}
                  <strong>
                    {cancelAllCount}
                  </strong>{' '}
                  {activeTab === 'pending' ? 'pending orders' : 'open positions'}.
                </p>
                {/* <p>You are about to cancel {openOrdersCount} open orders.</p> */}
                <p className="warning-text">This action cannot be undone.</p>
                <div className="modal_btn">
                  <button
                    className="modal-button  keep_order"
                    onClick={() => setShowCancelAllModal(false)}
                  >
                    Close
                  </button>
                  <button
                    className="modal-button primary danger"
                    onClick={handleModalConfirm}
                    // onClick={handleCancelAll}
                    disabled={cancellingAll}
                  >
                    {cancellingAll
                      ? 'Processing...'
                      : activeTab === 'pending'
                        ? 'Cancel All Pending'
                        : 'Close All Open'}
                    {/* {cancellingAll ? 'Cancelling…' : 'Cancel All Orders'} */}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {showOrderDetailsModal && selectedOrderLive && (
          <div className="modal-overlay" onClick={() => setShowOrderDetailsModal(false)}>
            <div className="modal-content large order-details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header order-details-header">
                <div className="order-details-header-text">
                  <h2>Order Details</h2>
                  {selectedOrderLive.market === 'india' && selectedOrderLive.expiryTimeFull && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      width: 'fit-content'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                        Expiry: <span style={{ color: '#ef4444', fontWeight: '600' }}>{selectedOrderLive.expiryTimeFull}</span>
                      </span>
                    </div>
                  )}
                </div>
                <button
                  className="modal-close"
                  onClick={() => setShowOrderDetailsModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body order-details-body">
                <div className="order-details-top">
                  <div className="order-details-symbol-wrap">
                    <div className="order-details-symbol">{selectedOrderLive.pair || '-'}</div>
                    <div className="order-details-chips">
                      {selectedOrderNoLabel ? (
                        <span className="order-details-chip" title="Order number">
                          #{selectedOrderNoLabel}
                        </span>
                      ) : null}
                      <span className={`order-details-chip order-details-chip--side ${selectedOrderLive.side === 'buy' ? 'is-buy' : 'is-sell'}`}>
                        {selectedOrderLive.side === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                      <span className="order-details-chip">{getTypeBadge(selectedOrderLive.type).label}</span>
                      {/* <span className="order-details-chip">{selectedOrderLive.marketTag || '-'}</span> */}
                      {selectedOrderLive.raw?.istatus && (
                        <span className="order-details-chip" style={{ textTransform: 'uppercase' }}>{selectedOrderLive.raw.istatus}</span>
                      )}
                    </div>
                  </div>
                  <div className={`order-details-pnl-card ${Number(selectedOrderLive.profit || 0) >= 0 ? 'is-profit' : 'is-loss'}`}>
                    <span className="order-details-pnl-label">
                      {selectedOrderLive._sourceTab === 'history' ? 'Realized P&L' : 'Live P&L'}
                    </span>
                    <strong className="order-details-pnl-value">
                      {formatPnlCurrency(selectedOrderLive.profit || 0, selectedOrderLive.market).text}
                    </strong>
                  </div>
                </div>

                <div className="order-details-section">
                  <h3>Price &amp; Risk</h3>
                  <div className="order-details-grid">
                    <div className="detail-item">
                      <label>{selectedOrderLive._sourceTab === 'history' ? 'Open Price' : 'Entry Price'}</label>
                      <div className="detail-value">
                        {selectedOrderLive.price ? `${selectedOrderLive.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Market Price'}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>{selectedOrderLive._sourceTab === 'history' ? 'Close Price' : 'Current Price'}</label>
                      <div className="detail-value">
                        {(selectedOrderLive._sourceTab === 'history'
                          ? selectedOrderLive.closePrice ?? selectedOrderLive.avgFillPrice
                          : selectedOrderLive.currentPrice) != null
                          ? Number(
                            selectedOrderLive._sourceTab === 'history'
                              ? selectedOrderLive.closePrice ?? selectedOrderLive.avgFillPrice
                              : selectedOrderLive.currentPrice
                          ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                          : '-'}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>TP</label>
                      <div className="detail-value">{selectedOrderLive.tp ?? '0'}</div>
                    </div>
                    <div className="detail-item">
                      <label>SL</label>
                      <div className="detail-value">{selectedOrderLive.sl ?? '0'}</div>
                    </div>
                  </div>
                </div>

                <div className="order-details-section">
                  <h3>Execution Details</h3>
                  <div className="order-details-grid">
                    <div className="detail-item">
                      <label>Order No.</label>
                      <div className="detail-value">
                        {selectedOrderNoLabel || '—'}
                        {selectedOrderNoLabel ? (
                          <button
                            className="copy-button"
                            onClick={async () => {
                              try {
                                await copyToClipboard(selectedOrderNoLabel);
                              } catch (err) {
                                console.error('Copy failed:', err);
                              }
                            }}
                            aria-label="Copy order number"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {/* <div className="detail-item">
                      <label>Status</label>
                      <div className="detail-value">
                        <span className={`status-badge ${getStatusBadge(selectedOrderLive.status).color}`}>
                          {getStatusBadge(selectedOrderLive.status).icon} {getStatusBadge(selectedOrderLive.status).label}
                        </span>
                      </div>
                    </div> */}
                    <div className="detail-item">
                      <label>Size</label>
                      <div className="detail-value">
                        {Number(selectedOrderLive.lotSize ?? selectedOrderLive.amount ?? 0).toFixed(4)}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>Filled</label>
                      <div className="detail-value">
                        {Number(selectedOrderLive.filled ?? selectedOrderLive.lotSize ?? 0).toFixed(4)}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>Total</label>
                      <div className="detail-value">
                        {Number(selectedOrderLive.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>Fee</label>
                      <div className="detail-value">
                        {Number(selectedOrderLive.fee).toFixed(2)} {selectedOrderLive.feeAsset}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>P&amp;L</label>
                      <div className={`detail-value ${Number(selectedOrderLive.profit || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                        {formatPnlCurrency(selectedOrderLive.profit || 0, selectedOrderLive.market).text}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>Created At</label>
                      <div className="detail-value">{formatDate(selectedOrderLive.createdAt)}</div>
                    </div>
                    {selectedOrderLive.completedAt && (
                      <div className="detail-item">
                        <label>Completed At</label>
                        <div className="detail-value">{formatDate(selectedOrderLive.completedAt)}</div>
                      </div>
                    )}
                  </div>
                </div>
                {selectedOrderLive._sourceTab === 'history' && Array.isArray(selectedOrderLive.tpslActions) && selectedOrderLive.tpslActions.length > 0 && (
                  <div className="order-details-section">
                    <h3>TP/SL Actions</h3>
                    <div className="order-details-grid">
                      {selectedOrderLive.tpslActions.map((action, idx) => (
                        <div className="detail-item" key={`history-tpsl-${idx}`} style={{ gridColumn: '1 / -1' }}>
                          <label>{action?.action_type || 'Action'}</label>
                          <div className="detail-value">
                            {String(action?.status || action?.action_status || '-')} | TP {action?.tradepofit ?? '-'} | SL {action?.stoploss ?? '-'} | {action?.action_time ?? '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* <div className="">
                  <button
                    className="modal-button "
                    onClick={() => setShowOrderDetailsModal(false)}
                  >
                    Close
                  </button>
                </div> */}
              </div>

            </div>
          </div>
        )}

        {/* Share Preview Modal */}
        {showShareModal && orderToShare && (
          <div className="modal-overlay" onClick={handleCloseShareModal}>
            <div className="modal-content share-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Share Order</h2>
                <button
                  className="modal-close"
                  onClick={handleCloseShareModal}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body share-modal-body">
                {shareImageUrl ? (
                  <div className="share-preview-container">
                    {/* <img src={shareImageUrl} alt="Share preview" className="share-preview-image" /> */}
                    <div className="share-container">
                      {/* Header with Logo and Company Name */}
                      <div className="share-header">
                        <div className='share_flex'>
                          <div className="share-logo">
                            <img src={logo} style={{ height: "32px", borderRadius: "4px" }} alt="" />
                          </div>
                          <div className="share-brand">
                            <h1 className="share-brand-name">M5dex</h1>
                            <p className="share-brand-tagline">Exchange | Trading Platform</p>
                          </div>
                        </div>
                        <div className="share-header-badges">
                          {/* <span className="share-badge currency">USDT</span> */}
                          <span className="share-badge currency">{orderToShare.pair}</span>
                          <span className={`share-badge position ${orderToShare.side === 'buy' ? 'long' : 'short'}`}>
                            {orderToShare.side === 'buy' ? 'Long' : 'Short'}
                          </span>
                        </div>
                      </div>

                      {/* Trading Pair Badge */}
                      {/* <div className="share-pair-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4.34014 1.00392V1.00445C4.18779 1.00392 4.06432 1.1274 4.06432 1.27974V2.76738C4.06432 2.91973 4.1878 3.0432 4.34014 3.0432C4.49248 3.0432 4.61596 2.91972 4.61596 2.76738V2.29965H6.03942V1.748H4.61596V1.27973C4.61596 1.12738 4.49248 1.00392 4.34014 1.00392ZM6.75846 1.00392V1.00445C6.60611 1.00392 6.48263 1.1274 6.48263 1.27974V2.76738C6.48263 2.91973 6.60611 3.0432 6.75846 3.0432C6.9108 3.0432 7.03428 2.91972 7.03428 2.76738V2.29965H8.45828V1.748H7.03428V1.27973C7.03428 1.12738 6.9108 1.00392 6.75846 1.00392ZM9.6701 3.57249H3.84668C3.697 3.57249 3.57513 3.69383 3.57513 3.84405C3.57513 3.99426 3.697 4.1156 3.84668 4.1156H9.6701C9.81978 4.1156 9.94165 3.99426 9.94165 3.84405C9.94165 3.69383 9.81978 3.57249 9.6701 3.57249ZM9.32425 5.30125H5.79517C5.64282 5.30125 5.51934 5.42473 5.51934 5.57707C5.51934 5.72942 5.64282 5.8529 5.79517 5.8529H9.32425C9.4766 5.8529 9.60007 5.72942 9.60007 5.57707C9.60007 5.42472 9.47659 5.30125 9.32425 5.30125ZM4.19258 5.30125C4.04023 5.30125 3.91676 5.42473 3.91676 5.57707C3.91676 5.72942 4.04024 5.8529 4.19258 5.8529C4.34492 5.8529 4.46841 5.72942 4.46841 5.57707C4.46841 5.42472 4.34492 5.30125 4.19258 5.30125ZM9.32425 7.41002V7.41056H5.79517C5.64282 7.41056 5.51934 7.53404 5.51934 7.68585C5.51934 7.8382 5.64282 7.96167 5.79517 7.96167H9.32425C9.4766 7.96167 9.60007 7.83819 9.60007 7.68585C9.60007 7.5335 9.47659 7.41002 9.32425 7.41002ZM4.19258 7.41002V7.41056C4.04023 7.41002 3.91676 7.5335 3.91676 7.68585V7.68638C3.91676 7.83873 4.04024 7.96221 4.19258 7.96221C4.34492 7.96221 4.46841 7.83873 4.46841 7.68638V7.68585C4.46841 7.5335 4.34492 7.41002 4.19258 7.41002ZM9.32425 9.51934H5.79517C5.64282 9.51934 5.51934 9.64282 5.51934 9.79517C5.51934 9.94751 5.64282 10.071 5.79517 10.071H9.32425C9.4766 10.071 9.60007 9.94751 9.60007 9.79517C9.60007 9.64282 9.47659 9.51934 9.32425 9.51934ZM4.19258 9.51934C4.04023 9.51934 3.91676 9.64282 3.91676 9.79517C3.91676 9.94751 4.04024 10.071 4.19258 10.071C4.34492 10.071 4.46841 9.94751 4.46841 9.79517C4.46841 9.64282 4.34492 9.51934 4.19258 9.51934ZM9.17673 1.00392V1.00445C9.02438 1.00392 8.90091 1.1274 8.90091 1.27974V2.76738C8.90091 2.91973 9.02439 3.0432 9.17673 3.0432C9.32908 3.0432 9.45256 2.91972 9.45256 2.76738V2.29965H9.85454H9.86309H9.86362C10.2448 2.30446 10.5516 2.6145 10.5516 2.9967V10.7477C10.5516 11.1326 10.2394 11.4448 9.85452 11.4448H3.65478H3.65425H3.65371C3.27526 11.4426 2.96522 11.1326 2.96522 10.7477V2.9967C2.96522 2.62305 3.25708 2.31997 3.62005 2.30073H3.62112V1.74853H3.62005C2.95026 1.76778 2.41357 2.32104 2.41357 2.9967V10.7477C2.41357 11.4351 2.96897 11.9954 3.65533 11.9964H9.85452C10.5441 11.9964 11.1032 11.4373 11.1032 10.7477V2.9967C11.1032 2.3066 10.5441 1.748 9.85452 1.748H9.45254V1.27973C9.45254 1.12738 9.32908 1.00392 9.17673 1.00392Z" fill="white" stroke="white" stroke-width="0.1" />
                        </svg>
                        {orderToShare.pair}
                      </div> */}

                      {/* Key Metrics */}
                      <div className="share-metrics">
                        <div className="share-metric-item">
                          <span className="share-metric-label">Entry Price</span>
                          <span className="share-metric-value">
                            {orderToShare.avgFillPrice ? orderToShare.avgFillPrice.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : (orderToShare.price ? orderToShare.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'Market')}
                          </span>
                        </div>
                        <div className="share-metric-item">
                          <span className="share-metric-label">
                            {isHistoryShare ? 'Close Price' : <>Current Price </>}
                            {/* <span className="live-badge">LIVE</span> */}
                          </span>
                          <span className="share-metric-value">
                            {shareCurrentPrice != null
                              ? Number(shareCurrentPrice).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                              : '-'}
                          </span>
                        </div>
                        <div className="share-metric-item">
                          <span className="share-metric-label">Size</span>
                          <span className="share-metric-value">{orderToShare?.lotsize || orderToShare?.lotSize ? `${Number(orderToShare?.lotsize || orderToShare?.lotSize).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : (orderToShare.filled ?? orderToShare.amount ?? 0)}</span>
                        </div>
                      </div>
                      {/* ROE Section - show for both open (with currentPrice) and history */}
                      {roiData ? (
                        <div className="share-roe-card">
                          <div className="share-roe-label">ROE%</div>
                          <div className={`share-roe-value ${roiData.isPositive ? 'positive' : 'negative'}`}>
                            {roiData.isPositive ? '+' : ''}{roiData.roi}%
                          </div>
                          <div className="share-roe-chart">
                            <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                              <path d="M0,50 Q50,30 100,35 T200,25" fill="none" stroke={roiData.isPositive ? '#10b981' : '#ef4444'} strokeWidth="2" />
                              <path d="M0,50 Q50,30 100,35 T200,25 L200,60 L0,60 Z" fill={roiData.isPositive ? 'url(#gradient-green)' : 'url(#gradient-red)'} opacity="0.2" />
                              <defs>
                                <linearGradient id="gradient-green" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="gradient-red" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="share-roe-card">
                          <div className="share-roe-label">ROE%</div>
                          <div className="share-roe-value neutral">-</div>
                        </div>
                      )}

                      {/* Footer with Discount and QR Code */}
                      {/* <div className="share-footer-promo">
                        <div className="share-promo-text">
                          <p className="share-promo-title">Join and get up to 10% fee discount</p>
                          <p className="share-promo-code">use code: ARK2024</p>
                        </div>
                        <button className="share-social-btn download" onClick={handleDownloadShare} title="Download Image">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                        <div className="share-qr-code">
                          <QRCodeSVG value="https://ark-exchange.com/register?ref=ARK2024" size={64} level="M" />
                        </div>
                      </div> */}

                      {/* <div className="share-actions">
                        <div className="share-social-buttons">
                          <button className="share-social-btn download" onClick={handleDownloadShare} title="Download Image">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                          <button className="share-social-btn twitter" onClick={() => handleSocialShare('twitter')} title="Share on Twitter">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                            </svg>
                          </button>
                          <button className="share-social-btn facebook" onClick={() => handleSocialShare('facebook')} title="Share on Facebook">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                            </svg>
                          </button>
                          <button className="share-social-btn whatsapp" onClick={() => handleSocialShare('whatsapp')} title="Share on WhatsApp">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                          </button>
                          <button className="share-social-btn telegram" onClick={() => handleSocialShare('telegram')} title="Share on Telegram">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                          </button>
                          <button className="share-social-btn linkedin" onClick={() => handleSocialShare('linkedin')} title="Share on LinkedIn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </button>
                          <button className="share-social-btn copy" onClick={() => handleSocialShare('copy')} title="Copy Image">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </div> */}
                    </div>


                  </div>
                ) : (
                  <div className="share-loading">
                    <div className="loading-spinner"></div>
                    <p>Generating share image...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden Share Template */}
        {orderToShare && (
          <div ref={shareTemplateRef} className="share-template" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <div className="share-container">
              {/* Header with Logo and Company Name */}
              <div className="share-header">
                <div className="share-logo">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="share-brand">
                  <h1 className="share-brand-name">M5dex</h1>
                  <p className="share-brand-tagline">Exchange | Trading Platform</p>
                </div>
                {/* <div className="share-header-badges">
                  <span className="share-badge currency">{orderToShare.quote}</span>
                  <span className={`share-badge position ${orderToShare.side === 'buy' ? 'long' : 'short'}`}>
                    {orderToShare.side === 'buy' ? 'Long' : 'Short'}
                  </span>
                </div> */}
              </div>

              {/* Trading Pair Badge */}
              {/* <div className="share-pair-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {orderToShare.pair}
              </div> */}

              {/* Key Metrics */}
              <div className="share-metrics">
                <div className="share-metric-item">
                  <span className="share-metric-label">Entry Price</span>
                  <span className="share-metric-value">
                    {orderToShare.avgFillPrice ? orderToShare.avgFillPrice.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : (orderToShare.price ? orderToShare.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'Market')}
                  </span>
                </div>
                <div className="share-metric-item">
                  <span className="share-metric-label">
                    {isHistoryShare ? 'Close Price' : 'Current Price'}
                  </span>
                  <span className="share-metric-value">
                    {shareCurrentPrice != null
                      ? Number(shareCurrentPrice).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                      : '-'}
                  </span>
                </div>
                <div className="share-metric-item">
                  <span className="share-metric-label">Size</span>
                  <span className="share-metric-value">{orderToShare.amount != null ? `${Number(orderToShare.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${orderToShare.base || ''}` : (orderToShare.filled ?? orderToShare.amount ?? 0)}</span>
                </div>
              </div>

              {/* ROE Section - show for both open and history */}
              {roiData ? (
                <div className="share-roe-card">
                  <div className="share-roe-label">ROE%</div>
                  <div className={`share-roe-value ${roiData.isPositive ? 'positive' : 'negative'}`}>
                    {roiData.isPositive ? '+' : ''}{roiData.roi}%
                  </div>
                  <div className="share-roe-chart">
                    <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                      <path d="M0,50 Q50,30 100,35 T200,25" fill="none" stroke={roiData.isPositive ? '#10b981' : '#ef4444'} strokeWidth="2" />
                      <path d="M0,50 Q50,30 100,35 T200,25 L200,60 L0,60 Z" fill={roiData.isPositive ? 'url(#gradient-green)' : 'url(#gradient-red)'} opacity="0.2" />
                      <defs>
                        <linearGradient id="gradient-green" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradient-red" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="share-roe-card">
                  <div className="share-roe-label">ROE%</div>
                  <div className="share-roe-value neutral">-</div>
                </div>
              )}

              {/* Footer with Discount and QR Code */}
              {/* <div className="share-footer-promo">
                <div className="share-promo-text">
                  <p className="share-promo-title">Join and get up to 10% fee discount</p>
                  <p className="share-promo-code">use code: ARK2024</p>
                </div>
                <div className="share-qr-code">
                  <QRCodeSVG value="https://ark-exchange.com/register?ref=ARK2024" size={64} level="M" />
                </div>
              </div> */}
            </div>
          </div>
        )}

        <TP_SL_Modal
          isOpen={tpslModalOpen}
          position={selectedPosition}
          onClose={handleCloseTPSLModal}
          onSave={handleSaveTPSL}
          isSaving={tpslSaving}
        />
      </div>
    </>
  );
};

export default Orders;

