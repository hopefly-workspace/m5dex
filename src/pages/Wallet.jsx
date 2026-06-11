import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
} from "recharts";
import Header from "../components/Header";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import OTPInput from "../components/OTPInput";
import { formatBalanceAmount, shortenAddress } from "../utils/helper";
import {
  getEmptyWalletData,
  normalizeWalletFromApi,
  ASSET_COLORS,
  normalizeTradingBalanceRows,
} from "../services/walletApi";
import { getCryptoBalance, getForexBalance } from "../services/tradingApi";
import "../styles/pages/Wallet.css";
import { useToast } from "../contexts/ToastContext";
import { Copy } from "lucide-react";
import { getDeviceInfo } from "../utils/clientDeviceInfo";

const WALLET_BALANCE_HISTORY_API = "/wallet/balancehistory";
const DEPOSIT_HISTORY_API = "/wallet/deposits";
const WITHDRAWAL_HISTORY_API = "/wallet/withdrawalhistory";
const BEFORE_WITHDRAW_API = "/wallet/before_withdraw";
const FINAL_WITHDRAW_API = "/wallet/withdraw";
const WITHDRAW_NETWORK_OPTIONS = {
  USDT: ["TRC20", "BEP20"],
  USDC: ["BEP20"],
  BTC: ["BTC"],
  ETH: ["BEP20"],
  DEFAULT: ["TRC20", "BEP20"],
};

/** Backend expects market type id in `walletid` (not the user's wallet UUID). */
const BALANCE_HISTORY_WALLETID_BY_TAB = {
  spot: 1,
  crypto: 2,
  forex: 3,
  indian: 4,
};

function getBalanceHistoryWalletId(tab) {
  const id = BALANCE_HISTORY_WALLETID_BY_TAB[tab];
  return id != null ? id : null;
}

/** Normalize POST /wallet/balancehistory response to a row array. */
function normalizeBalanceHistoryResponse(response) {
  if (!response) return null;
  const root = response?.data ?? response?.result ?? response;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return null;
  const list =
    root.data ??
    root.list ??
    root.history ??
    root.balancehistory ??
    root.balanceHistory ??
    root.records ??
    root.items ??
    root.transactions ??
    root.rows;
  return Array.isArray(list) ? list : null;
}

/** Rows from POST /wallet/balancehistory (array only). */
function extractTransferHistoryRows(normalized) {
  if (!normalized) return null;
  if (Array.isArray(normalized)) {
    return normalized.filter((r) => r && typeof r === "object");
  }
  return null;
}

function transferRowTimeValue(r) {
  const v = r?.ondate ?? r?.created_at ?? r?.createdAt ?? r?.date ?? r?.on_date ?? r?.timestamp;
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function transferRowDate(r) {
  const v = r?.ondate ?? r?.created_at ?? r?.createdAt ?? r?.date ?? r?.on_date ?? r?.timestamp ?? "";
  if (v == null || v === "") return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

/** `/wallet/balancehistory` rows use `plus` / `minus`; legacy rows use `transfer_type` + `amount`. */
function balanceRowPlus(r) {
  if (r?.plus != null && r.plus !== "") {
    const n = parseFloat(r.plus);
    return Number.isFinite(n) ? n : 0;
  }
  if (String(r?.transfer_type ?? r?.transferType ?? "").toUpperCase() === "CREDIT") {
    const n = parseFloat(r?.amount ?? r?.amt ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function balanceRowMinus(r) {
  if (r?.minus != null && r.minus !== "") {
    const n = parseFloat(r.minus);
    return Number.isFinite(n) ? n : 0;
  }
  if (String(r?.transfer_type ?? r?.transferType ?? "").toUpperCase() === "DEBIT") {
    const n = parseFloat(r?.amount ?? r?.amt ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function transferRowBalanceAfter(r) {
  const raw =
    r?.remain ??
    r?.balance_after ??
    r?.balanceAfter ??
    r?.after_balance ??
    r?.afterBalance ??
    r?.wallet_balance ??
    r?.walletBalance ??
    r?.closing_balance ??
    r?.closingBalance ??
    r?.balance ??
    NaN;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function transferRowWalletAccount(r) {
  return String(r?.wallet ?? r?.wallet_type ?? r?.walletType ?? "").trim() || "—";
}

function transferRowActivityNote(r) {
  return String(r?.note ?? r?.transfer_type ?? "").trim() || "—";
}

function formatHistoryNonZeroAmount(value, hideBalance) {
  if (hideBalance) return "****";
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${formatBalanceAmount(n, 8)} USDT`;
}

function formatHistoryRemain(value, hideBalance) {
  if (hideBalance) return "****";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${formatBalanceAmount(n, 8)} USDT`;
}

/** Local calendar `YYYY-MM-DD` → start of day (ms). */
function localDayStartMs(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return null;
  const [y, m, d] = isoDateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Local calendar `YYYY-MM-DD` → end of day (ms). */
function localDayEndMs(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== "string") return null;
  const [y, m, d] = isoDateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return Number.isNaN(t) ? null : t;
}

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function filterBalanceHistoryRows(rows, dateFromStr, dateToStr) {
  if (!rows || rows.length === 0) return [];
  const fromMs = localDayStartMs(dateFromStr);
  const toMs = localDayEndMs(dateToStr);
  if (fromMs == null && toMs == null) return [...rows];
  return rows.filter((r) => {
    const t = transferRowTimeValue(r)?.getTime();
    if (t == null) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

function sortBalanceHistoryRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = transferRowTimeValue(a)?.getTime() ?? 0;
    const tb = transferRowTimeValue(b)?.getTime() ?? 0;
    return tb - ta;
  });
}

function normalizeWithdrawalHistoryResponse(response) {
  const root = response?.data ?? response?.result ?? response;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];
  const list =
    root.data ??
    root.list ??
    root.history ??
    root.withdrawalhistory ??
    root.withdrawalHistory ??
    root.withdraws ??
    root.withdrawals ??
    root.items ??
    root.rows;
  return Array.isArray(list) ? list : [];
}

function withdrawalRowDate(r) {
  const v = r?.created_at ?? r?.createdAt ?? r?.ondate ?? r?.date ?? r?.timestamp ?? "";
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function withdrawalRowTimeValue(r) {
  const v = r?.created_at ?? r?.createdAt ?? r?.ondate ?? r?.date ?? r?.timestamp;
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function withdrawalRowAmount(r) {
  const n = parseFloat(r?.amount ?? r?.qty ?? r?.withdraw_amount ?? r?.withdrawAmount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// function withdrawalRowStatus(r) {
//   return String(r?.status ?? r?.withdraw_status ?? r?.state ?? "Pending").trim() || "Pending";
// }

function normalizeDepositHistoryResponse(response) {
  if (!response) return [];
  if (response?.status === true && Array.isArray(response.deposits)) {
    return response.deposits;
  }
  const root = response?.data ?? response?.result ?? response;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];
  const list =
    root.deposits ??
    root.data ??
    root.list ??
    root.history ??
    root.records ??
    root.items ??
    root.rows;
  return Array.isArray(list) ? list : [];
}

function depositRowTimeValue(r) {
  const v = r?.ondate ?? r?.created_at ?? r?.createdAt ?? r?.trandate ?? r?.date ?? r?.timestamp;
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function depositRowDate(r) {
  const v = r?.ondate ?? r?.created_at ?? r?.createdAt ?? r?.date ?? r?.timestamp ?? "";
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function depositRowAmount(r) {
  const n = parseFloat(r?.amount ?? r?.usdtamount ?? r?.qty ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function depositRowStatus(r) {
  return String(r?.status ?? r?.istatus ?? r?.state ?? "Pending").trim() || "Pending";
}

function filterDepositHistoryRows(rows, dateFromStr, dateToStr) {
  if (!rows?.length) return [];
  const fromMs = localDayStartMs(dateFromStr);
  const toMs = localDayEndMs(dateToStr);
  if (fromMs == null && toMs == null) return [...rows];
  return rows.filter((r) => {
    const t = depositRowTimeValue(r)?.getTime();
    if (t == null) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

function sortDepositHistoryRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = depositRowTimeValue(a)?.getTime() ?? 0;
    const tb = depositRowTimeValue(b)?.getTime() ?? 0;
    return tb - ta;
  });
}

function withdrawalRowStatus(r) {
  return String(
    r?.istatus ??
    r?.status ??
    r?.withdraw_status ??
    r?.state ??
    "-"
  ).trim() || "-";
}

function filterWithdrawalHistoryRows(rows, dateFromStr, dateToStr) {
  if (!rows || rows.length === 0) return [];
  const fromMs = localDayStartMs(dateFromStr);
  const toMs = localDayEndMs(dateToStr);
  if (fromMs == null && toMs == null) return [...rows];
  return rows.filter((r) => {
    const t = withdrawalRowTimeValue(r)?.getTime();
    if (t == null) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  });
}

function sortWithdrawalHistoryRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = withdrawalRowTimeValue(a)?.getTime() ?? 0;
    const tb = withdrawalRowTimeValue(b)?.getTime() ?? 0;
    return tb - ta;
  });
}

function validateWithdrawalAddressByNetwork(network, address) {
  const net = String(network || "").trim().toUpperCase();
  const addr = String(address || "").trim();
  if (!addr) return "Withdrawal address is required.";

  // EVM chains: ERC20 / BEP20 / POLYGON use 0x + 40 hex.
  if (["ERC20", "BEP20", "POLYGON"].includes(net)) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return `Invalid ${net} address format.`;
    }
    return "";
  }

  // TRON mainnet address format.
  if (net === "TRC20") {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) {
      return "Invalid TRC20 address format.";
    }
    return "";
  }

  // BTC legacy / segwit / bech32.
  if (net === "BTC") {
    if (!/^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr)) {
      return "Invalid BTC address format.";
    }
    return "";
  }

  // Generic fallback check for unknown network labels.
  if (addr.length < 8) return "Please enter a valid withdrawal address.";
  return "";
}

/** Page numbers with ellipses for large page counts. */
function buildPaginationWindow(current, total) {
  if (total <= 1) return [1];
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

const BALANCE_HISTORY_PAGE_SIZES = [10, 25, 50, 100];

const PERIOD_MS = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  All: 365 * 24 * 60 * 60 * 1000,
};

function buildPortfolioChartData(activeTab, chartPeriod, walletData, totalOverviewBalance, balanceHistoryRows) {
  const now = new Date();
  const periodMs = PERIOD_MS[chartPeriod] ?? PERIOD_MS["1W"];
  const periodStart = new Date(now.getTime() - periodMs);

  const formatPoint = (d, value) => ({
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    dateFull: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    value,
    timestamp: d.getTime(),
  });

  if (activeTab === "overview") {
    const balance = totalOverviewBalance ?? 0;
    if (balance <= 0) return [];
    const points = chartPeriod === "1D" ? 24 : chartPeriod === "1W" ? 7 : chartPeriod === "1M" ? 30 : chartPeriod === "3M" ? 90 : chartPeriod === "1Y" ? 12 : 12;
    const data = [];
    for (let i = 0; i <= points; i++) {
      const d = new Date(periodStart.getTime() + (i / points) * (now.getTime() - periodStart.getTime()));
      data.push(formatPoint(d, balance));
    }
    return data;
  }

  const currentBalance = parseFloat(walletData[activeTab]?.balance ?? 0) || 0;
  const transfers = Array.isArray(balanceHistoryRows) ? balanceHistoryRows : [];
  const inPeriod = transfers
    .filter((t) => {
      const d = transferRowTimeValue(t);
      return d && d >= periodStart && d <= now;
    })
    .sort((a, b) => {
      const ta = transferRowTimeValue(a)?.getTime() ?? 0;
      const tb = transferRowTimeValue(b)?.getTime() ?? 0;
      return ta - tb;
    });

  if (inPeriod.length === 0) {
    if (currentBalance <= 0) return [];
    return [
      formatPoint(periodStart, currentBalance),
      formatPoint(now, currentBalance),
    ];
  }

  const sumCredit = inPeriod.reduce((s, t) => s + balanceRowPlus(t), 0);
  const sumDebit = inPeriod.reduce((s, t) => s + balanceRowMinus(t), 0);
  let runningBalance = currentBalance - sumCredit + sumDebit;

  const data = [];
  data.push(formatPoint(periodStart, runningBalance));

  for (const t of inPeriod) {
    const plus = balanceRowPlus(t);
    const minus = balanceRowMinus(t);
    if (plus > 0) runningBalance += plus;
    if (minus > 0) runningBalance -= minus;
    const d = transferRowTimeValue(t);
    if (d) data.push(formatPoint(d, Math.max(0, runningBalance)));
  }

  data.push(formatPoint(now, currentBalance));
  return data;
}

const CHART_PERIODS = ["1D", "1W", "1M", "3M", "1Y", "All"];

const TRANSFER_ASSETS = ["USDT"];

// Overview tab removed — wallets: Spot, Crypto, Forex, Indian only.
const tabKeys = ["spot", "crypto", "forex", "indian"];

const WALLET_TAB_DISPLAY = {
  spot: "Spot",
  crypto: "Crypto",
  forex: "Forex",
  indian: "Indian",
};

const walletTypeLabel = {
  spot: "Spot Wallet",
  crypto: "Crypto Wallet",
  forex: "Forex Wallet",
  indian: "Indian Market",
};

const SPOT_HISTORY_TABS = [
  { id: "transfer", label: "Transfer" },
  { id: "deposit", label: "Deposit" },
  { id: "withdrawal", label: "Withdrawal" },
];

const Wallet = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState("spot");
  const [hideBalance, setHideBalance] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("1W");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState("spot");
  const [transferTo, setTransferTo] = useState("crypto");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferAsset, setTransferAsset] = useState("USDT");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [activePieIndex, setActivePieIndex] = useState(null);
  const [showAssetDistribution, setShowAssetDistribution] = useState(true);
  const [walletData, setWalletData] = useState(getEmptyWalletData);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState(null);
  const [balanceHistory, setBalanceHistory] = useState(null);
  const [balanceHistoryLoading, setBalanceHistoryLoading] = useState(false);
  const [balanceHistoryError, setBalanceHistoryError] = useState(null);
  const [balanceHistoryDateFrom, setBalanceHistoryDateFrom] = useState("");
  const [balanceHistoryDateTo, setBalanceHistoryDateTo] = useState("");
  const [balanceHistoryPage, setBalanceHistoryPage] = useState(1);
  const [balanceHistoryPageSize, setBalanceHistoryPageSize] = useState(25);
  const [withdrawalHistoryRows, setWithdrawalHistoryRows] = useState([]);
  const [withdrawalHistoryLoading, setWithdrawalHistoryLoading] = useState(false);
  const [withdrawalHistoryError, setWithdrawalHistoryError] = useState(null);
  const [withdrawalHistoryDateFrom, setWithdrawalHistoryDateFrom] = useState("");
  const [withdrawalHistoryDateTo, setWithdrawalHistoryDateTo] = useState("");
  const [withdrawalHistoryPage, setWithdrawalHistoryPage] = useState(1);
  const [withdrawalHistoryPageSize, setWithdrawalHistoryPageSize] = useState(25);
  const [depositHistoryRows, setDepositHistoryRows] = useState([]);
  const [depositHistoryLoading, setDepositHistoryLoading] = useState(false);
  const [depositHistoryError, setDepositHistoryError] = useState(null);
  const [depositHistoryDateFrom, setDepositHistoryDateFrom] = useState("");
  const [depositHistoryDateTo, setDepositHistoryDateTo] = useState("");
  const [depositHistoryPage, setDepositHistoryPage] = useState(1);
  const [depositHistoryPageSize, setDepositHistoryPageSize] = useState(25);
  const [spotHistoryTab, setSpotHistoryTab] = useState("transfer");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [beforeWithdrawLoading, setBeforeWithdrawLoading] = useState(false);
  const [withdrawOtpResendSeconds, setWithdrawOtpResendSeconds] = useState(0);
  const [withdrawOtpResending, setWithdrawOtpResending] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawStep, setWithdrawStep] = useState("form");
  const [beforeWithdrawPreview, setBeforeWithdrawPreview] = useState(null);
  const [withdrawForm, setWithdrawForm] = useState({
    coinname: "USDT",
    network: "",
    address: "",
    amount: "",
    note: "",
    otp: "",
  });
  const withdrawNetworkOptions = useMemo(() => {
    const coin = String(withdrawForm.coinname || "").trim().toUpperCase();
    return WITHDRAW_NETWORK_OPTIONS[coin] || WITHDRAW_NETWORK_OPTIONS.DEFAULT;
  }, [withdrawForm.coinname]);

  const [cryptoTradingRows, setCryptoTradingRows] = useState([]);
  const [cryptoTradingLoading, setCryptoTradingLoading] = useState(false);
  const [cryptoTradingError, setCryptoTradingError] = useState(null);
  const [forexTradingRows, setForexTradingRows] = useState([]);
  const [forexTradingLoading, setForexTradingLoading] = useState(false);
  const [forexTradingError, setForexTradingError] = useState(null);

  // const currentWallet = walletData[activeTab] ?? walletData.spot;

  // overview data
  const totalOverviewBalance = Object.keys(walletData)
    .filter(key => key !== 'overview')
    .reduce((acc, key) => acc + (walletData[key]?.available || 0), 0);

  const totalOverviewLocked = Object.keys(walletData)
    .filter(key => key !== 'overview')
    .reduce((acc, key) => acc + (walletData[key]?.locked || 0), 0);

  const overviewAssets = Object.keys(walletData)
    .filter(key => key !== 'overview')
    .map(key => {
      const wallet = walletData[key];
      const label = walletTypeLabel[key];
      return {
        // symbol: key.toUpperCase(),
        symbol: "USD",
        // name: walletTypeLabel[key],
        name: `${label} Balance`,
        amount: wallet.balance,
        usdValue: wallet.balance,
        percentage: totalOverviewBalance > 0
          ? Math.round((wallet.balance / totalOverviewBalance) * 100)
          : 0,
        color: ASSET_COLORS[key === "spot" ? "BTC" : key === "crypto" ? "ETH" : key === "forex" ? "USDT" : "Others"],
        border: ASSET_COLORS[key === "spot" ? "BTC" : key === "crypto" ? "ETH" : key === "forex" ? "USDT" : "Others"]
      };
    })
    .filter(asset => asset.amount > 0);

  const currentWallet = walletData[activeTab] ?? walletData.spot;

  const transferHistoryRows = useMemo(
    () => extractTransferHistoryRows(balanceHistory),
    [balanceHistory]
  );

  const balanceHistoryFilteredSorted = useMemo(() => {
    const raw = transferHistoryRows;
    if (!raw || raw.length === 0) return [];
    const filtered = filterBalanceHistoryRows(raw, balanceHistoryDateFrom, balanceHistoryDateTo);
    return sortBalanceHistoryRowsDesc(filtered);
  }, [transferHistoryRows, balanceHistoryDateFrom, balanceHistoryDateTo]);

  const balanceHistoryFilteredTotal = balanceHistoryFilteredSorted.length;
  const balanceHistoryTotalPages = Math.max(
    1,
    Math.ceil(balanceHistoryFilteredTotal / balanceHistoryPageSize) || 1
  );
  const balanceHistoryPageSafe = Math.min(Math.max(1, balanceHistoryPage), balanceHistoryTotalPages);
  const balanceHistoryPageOffset = (balanceHistoryPageSafe - 1) * balanceHistoryPageSize;
  const paginatedBalanceHistoryRows = useMemo(
    () =>
      balanceHistoryFilteredSorted.slice(
        balanceHistoryPageOffset,
        balanceHistoryPageOffset + balanceHistoryPageSize
      ),
    [balanceHistoryFilteredSorted, balanceHistoryPageOffset, balanceHistoryPageSize]
  );
  const balanceHistoryRangeLabel =
    balanceHistoryFilteredTotal === 0
      ? "0 entries"
      : `${balanceHistoryPageOffset + 1}–${Math.min(
        balanceHistoryPageOffset + balanceHistoryPageSize,
        balanceHistoryFilteredTotal
      )} of ${balanceHistoryFilteredTotal}`;

  const paginationWindow = useMemo(
    () => buildPaginationWindow(balanceHistoryPageSafe, balanceHistoryTotalPages),
    [balanceHistoryPageSafe, balanceHistoryTotalPages]
  );

  const balanceHistoryRawCount = transferHistoryRows?.length ?? 0;

  const withdrawalHistoryFilteredSorted = useMemo(() => {
    const filtered = filterWithdrawalHistoryRows(
      Array.isArray(withdrawalHistoryRows) ? withdrawalHistoryRows : [],
      withdrawalHistoryDateFrom,
      withdrawalHistoryDateTo
    );
    return sortWithdrawalHistoryRowsDesc(filtered);
  }, [withdrawalHistoryRows, withdrawalHistoryDateFrom, withdrawalHistoryDateTo]);

  const withdrawalHistoryTotal = withdrawalHistoryFilteredSorted.length;
  const withdrawalHistoryTotalPages = Math.max(
    1,
    Math.ceil(withdrawalHistoryTotal / withdrawalHistoryPageSize) || 1
  );
  const withdrawalHistoryPageSafe = Math.min(
    Math.max(1, withdrawalHistoryPage),
    withdrawalHistoryTotalPages
  );
  const withdrawalHistoryOffset = (withdrawalHistoryPageSafe - 1) * withdrawalHistoryPageSize;
  const paginatedWithdrawalRows = useMemo(
    () =>
      withdrawalHistoryFilteredSorted.slice(
        withdrawalHistoryOffset,
        withdrawalHistoryOffset + withdrawalHistoryPageSize
      ),
    [withdrawalHistoryFilteredSorted, withdrawalHistoryOffset, withdrawalHistoryPageSize]
  );
  const withdrawalPaginationWindow = useMemo(
    () => buildPaginationWindow(withdrawalHistoryPageSafe, withdrawalHistoryTotalPages),
    [withdrawalHistoryPageSafe, withdrawalHistoryTotalPages]
  );

  const depositHistoryFilteredSorted = useMemo(() => {
    const filtered = filterDepositHistoryRows(
      Array.isArray(depositHistoryRows) ? depositHistoryRows : [],
      depositHistoryDateFrom,
      depositHistoryDateTo
    );
    return sortDepositHistoryRowsDesc(filtered);
  }, [depositHistoryRows, depositHistoryDateFrom, depositHistoryDateTo]);

  const depositHistoryTotal = depositHistoryFilteredSorted.length;
  const depositHistoryTotalPages = Math.max(
    1,
    Math.ceil(depositHistoryTotal / depositHistoryPageSize) || 1
  );
  const depositHistoryPageSafe = Math.min(
    Math.max(1, depositHistoryPage),
    depositHistoryTotalPages
  );
  const depositHistoryOffset = (depositHistoryPageSafe - 1) * depositHistoryPageSize;
  const paginatedDepositRows = useMemo(
    () =>
      depositHistoryFilteredSorted.slice(
        depositHistoryOffset,
        depositHistoryOffset + depositHistoryPageSize
      ),
    [depositHistoryFilteredSorted, depositHistoryOffset, depositHistoryPageSize]
  );
  const depositPaginationWindow = useMemo(
    () => buildPaginationWindow(depositHistoryPageSafe, depositHistoryTotalPages),
    [depositHistoryPageSafe, depositHistoryTotalPages]
  );

  const showWalletByMarketSection = true;

  const overviewWalletBreakdown = useMemo(() => {
    const total = totalOverviewBalance || 0;
    const labels = { spot: "Spot Wallet", crypto: "Crypto Wallet", forex: "Forex Wallet", indian: "Indian Market" };
    const keys = ["spot", "crypto", "forex", "indian"];
    return keys.map((key) => {
      const w = walletData[key];
      const balance = parseFloat(w?.balance ?? 0) || 0;
      const available = parseFloat(w?.available ?? 0) || 0;
      const locked = parseFloat(w?.locked ?? 0) || 0;
      const pct = total > 0 ? (balance / total) * 100 : 0;
      return {
        key,
        label: labels[key] ?? key,
        balance,
        available,
        locked,
        percentage: pct,
        color: ASSET_COLORS[key === "spot" ? "BTC" : key === "crypto" ? "ETH" : key === "forex" ? "USDT" : "Others"] ?? ASSET_COLORS.Others,
      };
    });
  }, [walletData, totalOverviewBalance]);

  const overviewPieData = useMemo(
    () =>
      overviewWalletBreakdown
        .filter((row) => row.balance > 0)
        .map((row) => ({
          name: row.label.replace(/\s+Wallet$/, "").trim() || row.label,
          value: row.balance,
          color: row.color,
        })),
    [overviewWalletBreakdown]
  );

  const chartData = useMemo(
    () =>
      buildPortfolioChartData(
        activeTab,
        chartPeriod,
        walletData,
        totalOverviewBalance,
        balanceHistory
      ),
    [activeTab, chartPeriod, walletData, totalOverviewBalance, balanceHistory]
  );

  const fetchWalletBalance = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      setWalletData(getEmptyWalletData());
      setBalanceError(null);
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);
    setBalanceError(null);

    try {
      const response = await api.get("/wallet/balance");
      const normalized = normalizeWalletFromApi(response);
      if (normalized) {
        setWalletData(normalized);
      }
    } catch (err) {
      const msg = err?.message || err?.data?.message || "Failed to fetch wallet balance";
      setBalanceError(msg);
      if (err?.status !== 401) console.error("Wallet balance fetch error:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [isAuthenticated]);

  const fetchWalletBalanceHistory = useCallback(async (tab) => {
    const walletid = getBalanceHistoryWalletId(tab);
    if (walletid == null) {
      setBalanceHistory(null);
      setBalanceHistoryError(null);
      setBalanceHistoryLoading(false);
      return;
    }
    setBalanceHistoryLoading(true);
    setBalanceHistoryError(null);
    try {
      const response = await api.post(WALLET_BALANCE_HISTORY_API, {
        walletid,
      });
      const rows = normalizeBalanceHistoryResponse(response);
      setBalanceHistory(Array.isArray(rows) ? rows : []);
      setBalanceHistoryPage(1);
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to load balance history";
      setBalanceHistoryError(msg);
      setBalanceHistory(null);
    } finally {
      setBalanceHistoryLoading(false);
    }
  }, []);

  const fetchTradingBalanceSheet = useCallback(
    async (kind, setRows, setLoading, setErr) => {
      if (!isAuthenticated) {
        setRows([]);
        setErr(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const response =
          kind === "crypto" ? await getCryptoBalance() : await getForexBalance();
        setRows(normalizeTradingBalanceRows(response));
      } catch (e) {
        setErr(e?.message || "Failed to load balance");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated]
  );

  const fetchCryptoTradingBalance = useCallback(() => {
    return fetchTradingBalanceSheet("crypto", setCryptoTradingRows, setCryptoTradingLoading, setCryptoTradingError);
  }, [fetchTradingBalanceSheet]);

  const fetchForexTradingBalance = useCallback(() => {
    return fetchTradingBalanceSheet("forex", setForexTradingRows, setForexTradingLoading, setForexTradingError);
  }, [fetchTradingBalanceSheet]);

  const refreshWallet = useCallback(async () => {
    await fetchWalletBalance(true);
    if (activeTab === "crypto") await fetchCryptoTradingBalance();
    else if (activeTab === "forex") await fetchForexTradingBalance();
    if (getBalanceHistoryWalletId(activeTab) != null) {
      await fetchWalletBalanceHistory(activeTab);
    }
  }, [
    fetchWalletBalance,
    activeTab,
    fetchCryptoTradingBalance,
    fetchForexTradingBalance,
    fetchWalletBalanceHistory,
  ]);

  const tradingSheet = useMemo(() => {
    if (activeTab === "crypto") {
      return {
        rows: cryptoTradingRows,
        loading: cryptoTradingLoading,
        error: cryptoTradingError,
        refetch: fetchCryptoTradingBalance,
        unit: "USDT",
        title: "Live crypto balances",
      };
    }
    if (activeTab === "forex") {
      return {
        rows: forexTradingRows,
        loading: forexTradingLoading,
        error: forexTradingError,
        refetch: fetchForexTradingBalance,
        unit: "USD",
        title: "Live forex balances",
      };
    }
    return {
      rows: [],
      loading: false,
      error: null,
      refetch: null,
      unit: "",
      title: "",
    };
  }, [
    activeTab,
    cryptoTradingRows,
    cryptoTradingLoading,
    cryptoTradingError,
    forexTradingRows,
    forexTradingLoading,
    forexTradingError,
    fetchCryptoTradingBalance,
    fetchForexTradingBalance,
  ]);

  const tradingTotalAvailable = useMemo(
    () => tradingSheet.rows.reduce((s, r) => s + (Number(r.available) || 0), 0),
    [tradingSheet.rows]
  );

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCryptoTradingRows([]);
      setForexTradingRows([]);
      setCryptoTradingError(null);
      setForexTradingError(null);
      return;
    }
    if (activeTab === "crypto") fetchCryptoTradingBalance();
  }, [activeTab, isAuthenticated, fetchCryptoTradingBalance]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === "forex") fetchForexTradingBalance();
  }, [activeTab, isAuthenticated, fetchForexTradingBalance]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBalanceHistory(null);
      setBalanceHistoryError(null);
      setBalanceHistoryLoading(false);
      return;
    }
    if (getBalanceHistoryWalletId(activeTab) == null) {
      setBalanceHistory(null);
      setBalanceHistoryError(null);
      setBalanceHistoryLoading(false);
      return;
    }
    fetchWalletBalanceHistory(activeTab);
  }, [activeTab, isAuthenticated, fetchWalletBalanceHistory]);

  useEffect(() => {
    setBalanceHistoryDateFrom("");
    setBalanceHistoryDateTo("");
    setBalanceHistoryPage(1);
  }, [activeTab]);

  useEffect(() => {
    setBalanceHistoryPage(1);
  }, [balanceHistoryDateFrom, balanceHistoryDateTo, balanceHistoryPageSize]);

  useEffect(() => {
    setWithdrawalHistoryPage(1);
  }, [withdrawalHistoryDateFrom, withdrawalHistoryDateTo, withdrawalHistoryPageSize]);

  useEffect(() => {
    if (balanceHistoryPage !== balanceHistoryPageSafe) {
      setBalanceHistoryPage(balanceHistoryPageSafe);
    }
  }, [balanceHistoryPage, balanceHistoryPageSafe]);

  useEffect(() => {
    if (withdrawalHistoryPage !== withdrawalHistoryPageSafe) {
      setWithdrawalHistoryPage(withdrawalHistoryPageSafe);
    }
  }, [withdrawalHistoryPage, withdrawalHistoryPageSafe]);

  useEffect(() => {
    if (!showWithdrawModal || withdrawStep !== "otp" || withdrawOtpResendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setWithdrawOtpResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showWithdrawModal, withdrawStep, withdrawOtpResendSeconds]);

  const applyBalanceHistoryPreset = useCallback((preset) => {
    const now = new Date();
    const today = toLocalISODate(now);
    if (preset === "all") {
      setBalanceHistoryDateFrom("");
      setBalanceHistoryDateTo("");
      return;
    }
    if (preset === "7d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setBalanceHistoryDateFrom(toLocalISODate(d));
      setBalanceHistoryDateTo(today);
      return;
    }
    if (preset === "30d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setBalanceHistoryDateFrom(toLocalISODate(d));
      setBalanceHistoryDateTo(today);
      return;
    }
    if (preset === "month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setBalanceHistoryDateFrom(toLocalISODate(d));
      setBalanceHistoryDateTo(today);
    }
  }, []);

  const exportBalanceHistoryExcel = useCallback(() => {
    const rows = balanceHistoryFilteredSorted;
    if (!rows.length) {
      showError("No rows to export. Adjust filters or refresh data.");
      return;
    }
    const tabSlug = (WALLET_TAB_DISPLAY[activeTab] ?? activeTab ?? "wallet").replace(/\s+/g, "_");
    const mask = hideBalance;
    const detailRows = rows.map((r) => {
      const plus = balanceRowPlus(r);
      const minus = balanceRowMinus(r);
      const rem = transferRowBalanceAfter(r);
      return {
        "Date & time": transferRowDate(r),
        Credit: mask ? "****" : plus > 0 ? plus : "",
        Debit: mask ? "****" : minus > 0 ? minus : "",
        Remaining: mask ? "****" : rem ?? "",
        Note: transferRowActivityNote(r),
        Account: transferRowWalletAccount(r),
      };
    });
    const sumPlus = mask ? "****" : rows.reduce((s, r) => s + balanceRowPlus(r), 0);
    const sumMinus = mask ? "****" : rows.reduce((s, r) => s + balanceRowMinus(r), 0);
    const summaryRows = [
      {
        Metric: "Exported rows",
        Value: rows.length,
      },
      {
        Metric: "Total credit",
        Value: sumPlus,
      },
      {
        Metric: "Total debit",
        Value: sumMinus,
      },
      {
        Metric: "Date from (filter)",
        Value: balanceHistoryDateFrom || "(all)",
      },
      {
        Metric: "Date to (filter)",
        Value: balanceHistoryDateTo || "(all)",
      },
      {
        Metric: "Wallet tab",
        Value: walletTypeLabel[activeTab] ?? activeTab,
      },
    ];
    const wb = XLSX.utils.book_new();
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail["!cols"] = [
      { wch: 22 }, // Date & time
      { wch: 18 }, // Credit
      { wch: 18 }, // Debit
      { wch: 18 }, // Remaining
      { wch: 18 }, // Note
      { wch: 12 }, // Account
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Balance history");
    const wsSum = XLSX.utils.json_to_sheet(summaryRows);
    wsSum["!cols"] = [{ wch: 28 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, wsSum, "Summary");
    const stamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Balance_History_${tabSlug}_${stamp}.xlsx`);
    showSuccess(`Exported ${rows.length} row(s) to Excel.`);
  }, [
    activeTab,
    balanceHistoryFilteredSorted,
    balanceHistoryDateFrom,
    balanceHistoryDateTo,
    hideBalance,
    showError,
    showSuccess,
  ]);

  const exportWithdrawalHistoryExcel = useCallback(() => {
    const rows = withdrawalHistoryFilteredSorted;
    if (!rows.length) {
      showError("No withdrawal rows to export.");
      return;
    }
    const detailRows = rows.map((r) => ({
      "Date & time": withdrawalRowDate(r),
      Coin: String(r?.coinname ?? r?.coin ?? "—").toUpperCase(),
      Network: String(r?.network ?? "—").toUpperCase(),
      Address: String(r?.address ?? "—"),
      Amount: withdrawalRowAmount(r),
      Status: withdrawalRowStatus(r),
      Note: String(r?.note ?? "—"),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(detailRows);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 10 },
      { wch: 12 },
      { wch: 48 },
      { wch: 16 },
      { wch: 14 },
      { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Withdrawal history");
    const stamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Withdrawal_History_${stamp}.xlsx`);
    showSuccess(`Exported ${rows.length} withdrawal row(s).`);
  }, [showError, showSuccess, withdrawalHistoryFilteredSorted]);

  const exportDepositHistoryExcel = useCallback(() => {
    const rows = depositHistoryFilteredSorted;
    if (!rows.length) {
      showError("No deposit rows to export.");
      return;
    }
    const detailRows = rows.map((r) => ({
      "Date & time": depositRowDate(r),
      "Invoice ID": String(r?.invoiceid ?? r?.invoice_id ?? "—"),
      Asset: String(r?.asset ?? r?.coinname ?? "—").toUpperCase(),
      Amount: depositRowAmount(r),
      Status: depositRowStatus(r),
      "Order No": String(r?.orderno ?? r?.order_no ?? "—"),
      "Tran date": String(r?.trandate ?? "—"),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(detailRows);
    ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "Deposit history");
    const stamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Deposit_History_${stamp}.xlsx`);
    showSuccess(`Exported ${rows.length} deposit row(s).`);
  }, [depositHistoryFilteredSorted, showError, showSuccess]);

  const copyWithdrawalAddress = useCallback(
    async (address, successMessage = "copied.") => {
      const value = String(address ?? "").trim();
      if (!value || value === "—") return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const ta = document.createElement("textarea");
          ta.value = value;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        showSuccess(successMessage);
        // showSuccess("Address copied.");
      } catch {
        showError("Could not copy address.");
      }
    },
    [showError, showSuccess]
  );

  const openTransferModal = useCallback(() => {
    setTransferFrom(activeTab);
    // const other = tabKeys.filter((k) => k !== activeTab)[0] || "crypto";

    let defaultTo = "spot";
    if (activeTab === "spot") {
      defaultTo = "crypto";
    } else {
      defaultTo = "spot";
    }

    setTransferTo(defaultTo);
    // setTransferTo(other);
    setTransferAmount("");
    setTransferError(null);
    setShowTransferModal(true);
  }, [activeTab, tabKeys]);

  const closeTransferModal = useCallback(() => {
    if (!transferLoading) {
      setShowTransferModal(false);
      setTransferError(null);
    }
  }, [transferLoading]);

  const fetchWithdrawalHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setWithdrawalHistoryRows([]);
      setWithdrawalHistoryError(null);
      setWithdrawalHistoryLoading(false);
      return;
    }
    setWithdrawalHistoryLoading(true);
    setWithdrawalHistoryError(null);
    try {
      const res = await api.get(WITHDRAWAL_HISTORY_API);
      setWithdrawalHistoryRows(normalizeWithdrawalHistoryResponse(res));
    } catch (err) {
      setWithdrawalHistoryError(err?.message || err?.data?.message || "Failed to load withdrawal history");
      setWithdrawalHistoryRows([]);
    } finally {
      setWithdrawalHistoryLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWithdrawalHistory();
  }, [fetchWithdrawalHistory]);

  const fetchDepositHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setDepositHistoryRows([]);
      setDepositHistoryError(null);
      setDepositHistoryLoading(false);
      return;
    }
    setDepositHistoryLoading(true);
    setDepositHistoryError(null);
    try {
      const res = await api.get(DEPOSIT_HISTORY_API);
      setDepositHistoryRows(normalizeDepositHistoryResponse(res));
      setDepositHistoryPage(1);
    } catch (err) {
      setDepositHistoryError(err?.message || err?.data?.message || "Failed to load deposit history");
      setDepositHistoryRows([]);
    } finally {
      setDepositHistoryLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== "spot") return;
    fetchDepositHistory();
  }, [activeTab, isAuthenticated, fetchDepositHistory]);

  useEffect(() => {
    setDepositHistoryDateFrom("");
    setDepositHistoryDateTo("");
    setDepositHistoryPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "spot") return;
    setSpotHistoryTab("transfer");
  }, [activeTab]);

  useEffect(() => {
    setDepositHistoryPage(1);
  }, [depositHistoryDateFrom, depositHistoryDateTo, depositHistoryPageSize]);

  useEffect(() => {
    if (depositHistoryPage !== depositHistoryPageSafe) {
      setDepositHistoryPage(depositHistoryPageSafe);
    }
  }, [depositHistoryPage, depositHistoryPageSafe]);

  const resetWithdrawForm = useCallback(() => {
    setWithdrawForm({
      coinname: "USDT",
      network: "",
      address: "",
      amount: "",
      note: "",
      otp: "",
    });
    setWithdrawStep("form");
    setBeforeWithdrawPreview(null);
    setWithdrawError("");
    setWithdrawOtpResendSeconds(0);
    setWithdrawOtpResending(false);
  }, []);

  const openWithdrawModal = useCallback(() => {
    resetWithdrawForm();
    setShowWithdrawModal(true);
  }, [resetWithdrawForm]);

  const closeWithdrawModal = useCallback(() => {
    if (withdrawSubmitting || beforeWithdrawLoading) return;
    setShowWithdrawModal(false);
    resetWithdrawForm();
  }, [beforeWithdrawLoading, resetWithdrawForm, withdrawSubmitting]);

  const openDeposit = useCallback(() => {
    navigate("/deposit-crypto");
  }, [navigate]);

  const validateWithdrawForm = useCallback((otpRequired = false, otpOverride = null) => {
    const amountNum = parseFloat(withdrawForm.amount);
    if (!withdrawForm.coinname?.trim()) return "Coin is required.";
    if (!withdrawForm.network?.trim()) return "Network is required.";
    const addressErr = validateWithdrawalAddressByNetwork(withdrawForm.network, withdrawForm.address);
    if (addressErr) return addressErr;
    if (!Number.isFinite(amountNum) || amountNum <= 0) return "Please enter a valid amount.";
    if (amountNum > Number(currentWallet?.available ?? 0)) {
      return "Insufficient available balance.";
    }
    if (otpRequired) {
      const otp = String(otpOverride !== null ? otpOverride : withdrawForm.otp || "").trim();
      if (!/^\d{6}$/.test(otp)) return "Please enter a valid 6-digit OTP.";
    }
    return "";
  }, [currentWallet?.available, withdrawForm]);

  const handleBeforeWithdraw = useCallback(async () => {
    const validationMsg = validateWithdrawForm(false);
    if (validationMsg) {
      setWithdrawError(validationMsg);
      return;
    }
    setBeforeWithdrawLoading(true);
    setWithdrawError("");
    try {

      const deviceInfo = await getDeviceInfo();

      const payload = {
        amount: parseFloat(withdrawForm.amount),
        network: withdrawForm.network.trim(),
        coinname: withdrawForm.coinname.trim(),
        address: withdrawForm.address.trim(),
        note: withdrawForm.note?.trim() || "",
        device_info: deviceInfo,
      };
      const res = await api.post(BEFORE_WITHDRAW_API, payload);
      setBeforeWithdrawPreview(res?.data ?? res?.result ?? res ?? payload);
      setWithdrawStep("otp");
      setWithdrawOtpResendSeconds(30);
      setWithdrawForm((p) => ({ ...p, otp: "" }));
      showSuccess(res?.message || "Withdrawal pre-check successful. Enter OTP to confirm.");
    } catch (err) {
      setWithdrawError(err?.message || err?.data?.message || "Pre-check failed. Please verify details.");
    } finally {
      setBeforeWithdrawLoading(false);
    }
  }, [showSuccess, validateWithdrawForm, withdrawForm]);

  const handleResendWithdrawOtp = useCallback(async () => {
    if (withdrawOtpResendSeconds > 0 || withdrawOtpResending) return;
    const validationMsg = validateWithdrawForm(false);
    if (validationMsg) {
      setWithdrawError(validationMsg);
      return;
    }
    setWithdrawOtpResending(true);
    setWithdrawError("");
    try {
      const deviceInfo = await getDeviceInfo();

      const payload = {
        amount: parseFloat(withdrawForm.amount),
        network: withdrawForm.network.trim(),
        coinname: withdrawForm.coinname.trim(),
        address: withdrawForm.address.trim(),
        note: withdrawForm.note?.trim() || "",
        device_info: deviceInfo,
      };
      const res = await api.post(BEFORE_WITHDRAW_API, payload);
      setBeforeWithdrawPreview(res?.data ?? res?.result ?? res ?? payload);
      setWithdrawForm((p) => ({ ...p, otp: "" }));
      setWithdrawOtpResendSeconds(30);
      showSuccess(res?.message || "OTP resent successfully.");
    } catch (err) {
      setWithdrawError(err?.message || err?.data?.message || "Failed to resend OTP.");
    } finally {
      setWithdrawOtpResending(false);
    }
  }, [showSuccess, validateWithdrawForm, withdrawForm, withdrawOtpResendSeconds, withdrawOtpResending]);

  const handleFinalWithdraw = useCallback(async (otpOverride = null) => {
    const currentOtp = typeof otpOverride === 'string' ? otpOverride : withdrawForm.otp;
    const validationMsg = validateWithdrawForm(true, currentOtp);
    if (validationMsg) {
      setWithdrawError(validationMsg);
      return;
    }
    setWithdrawSubmitting(true);
    setWithdrawError("");
    try {

      const deviceInfo = await getDeviceInfo();

      const payload = {
        amount: parseFloat(withdrawForm.amount),
        network: withdrawForm.network.trim(),
        coinname: withdrawForm.coinname.trim(),
        address: withdrawForm.address.trim(),
        otp: String(currentOtp).trim(),
        note: withdrawForm.note?.trim() || "",
        device_info: deviceInfo,
      };
      await api.post(FINAL_WITHDRAW_API, payload);
      showSuccess("Withdrawal request submitted successfully.");
      setShowWithdrawModal(false);
      resetWithdrawForm();
      await Promise.all([refreshWallet(), fetchWithdrawalHistory()]);
    } catch (err) {
      setWithdrawError(err?.message || err?.data?.msg || err?.data?.message || "Withdrawal failed. Please try again.");
      setWithdrawForm((p) => ({ ...p, otp: "" }));
    } finally {
      setWithdrawSubmitting(false);
    }
  }, [fetchWithdrawalHistory, refreshWallet, resetWithdrawForm, showSuccess, validateWithdrawForm, withdrawForm]);

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      setTransferError("Please enter a valid amount.");
      return;
    }
    if (transferFrom === transferTo) {
      setTransferError("From and To wallets must be different.");
      return;
    }
    const fromWallet = walletData[transferFrom];
    const toWallet = walletData[transferTo];
    if (!fromWallet?.walletid || !toWallet?.walletid) {
      setTransferError("Wallet information is missing. Please refresh.");
      return;
    }

    if (amount > fromWallet.available) {
      setTransferError("Insufficient balance.");
      return;
    }

    setTransferLoading(true);
    setTransferError(null);

    try {
      await api.post("/wallet/transfer", {
        from: fromWallet.walletid,
        to: toWallet.walletid,
        asset: transferAsset,
        amount,
      });

      showSuccess('Wallet transfer successfully!');

      setTransferAmount("");
      setShowTransferModal(false);
      await refreshWallet();
      setTransferError(null);
    } catch (err) {
      const msg = err?.message || err?.data?.message || "Transfer failed. Please try again.";
      setTransferError(msg);
    } finally {
      setTransferLoading(false);
    }
  };

  const formatBalance = (amount) => {
    if (hideBalance) return "****";
    return formatBalanceAmount(amount, 6);
  };

  const getChangeColor = (change) => {
    return change >= 0 ? "var(--color-success)" : "var(--color-danger)";
  };

  const getChangeIcon = (change) => (change >= 0 ? "↗" : "↘");

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="wallet-chart-tooltip">
        <div className="wallet-chart-tooltip-value">
          ${(p.value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
        </div>
        <div className="wallet-chart-tooltip-date">{p.dateFull || p.date}</div>
      </div>
    );
  };

  const ChartCursor = (props) => {
    const { points, height, offset } = props;
    if (!points?.length) return null;
    const x = points[0].x;
    const top = offset?.top ?? 0;
    const h = height ?? offset?.height ?? 200;
    return (
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={top + h}
        stroke="var(--brand-primary)"
        strokeDasharray="4 4"
        strokeWidth={1}
        className="wallet-chart-cursor"
      />
    );
  };

  const getExplorerUrl = (network, address) => {
    if (!address) return "#";

    const explorerMap = {
      BEP20: `https://bscscan.com/address/${address}`,
      TRC20: `https://tronscan.org/#/address/${address}`,
    };

    return explorerMap[String(network).toUpperCase()] || "#";
  };

  const getTransactionExplorerUrl = (network, tranhash) => {
    if (!tranhash) return "#";

    const explorerMap = {
      BEP20: `https://bscscan.com/tx/${tranhash}`,
      TRC20: `https://tronscan.org/#/transaction/${tranhash}`,
    };

    return explorerMap[String(network).toUpperCase()] || "#";
  };

  const spotHistoryRefreshLoading =
    spotHistoryTab === "transfer"
      ? balanceHistoryLoading
      : spotHistoryTab === "deposit"
        ? depositHistoryLoading
        : withdrawalHistoryLoading;

  const refreshSpotHistory = useCallback(() => {
    if (spotHistoryTab === "transfer") fetchWalletBalanceHistory("spot");
    else if (spotHistoryTab === "deposit") fetchDepositHistory();
    else fetchWithdrawalHistory();
  }, [spotHistoryTab, fetchWalletBalanceHistory, fetchDepositHistory, fetchWithdrawalHistory]);

  const spotHistorySubtitle =
    spotHistoryTab === "transfer"
      ? "Transfers and ledger activity for your Spot wallet."
      : spotHistoryTab === "deposit"
        ? "Crypto deposits credited to your Spot wallet."
        : "Withdrawal requests and their current execution status.";

  return (
    <div className="wallet-page">
      <Header />

      <div className="wallet-container">
        <div className="wallet-tabs">
          {tabKeys.map((key) => (
            <button
              key={key}
              className={`wallet-tab ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <span className="tab-label">{WALLET_TAB_DISPLAY[key] ?? key}</span>
              {activeTab === key && (
                <span className="tab-badge">
                  {hideBalance ? "****" : `$${formatBalance(walletData[key]?.available ?? 0)}`}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="wallet-sections-row">
          {/* ——— Balance (left) ——— */}
          <section className="wallet-balance-card" aria-labelledby="wallet-balance-heading">
            <div className="wallet-balance-card-header">
              <h2 id="wallet-balance-heading" className="wallet-balance-title">
                {walletTypeLabel[activeTab] ?? "Spot Wallet"}
              </h2>
              <div className="wallet-balance-actions">
                <button
                  type="button"
                  className="wallet-refresh-btn"
                  onClick={refreshWallet}
                  disabled={balanceLoading}
                  title="Refresh balance"
                  aria-label="Refresh balance"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={balanceLoading ? "spin" : ""}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
                {/* <button
                type="button"
                className="hide-balance-toggle AssetDetail"
                onClick={() => setShowAssetDistribution(!showAssetDistribution)}
                title={showAssetDistribution ? "Hide asset details" : "Show asset details"}
              >
                <span>Asset Details</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button> */}
              </div>
            </div>

            {balanceError && (
              <div className="wallet-balance-error">
                <span>{balanceError}</span>
                <button type="button" className="wallet-retry-btn" onClick={refreshWallet} disabled={balanceLoading}>
                  Retry
                </button>
              </div>
            )}

            <div className="wallet-balance-content">
              <div className="balance-block">
                <div className="balance-label">Total Balance</div>
                {balanceLoading ? (
                  <div className="balance-loading">
                    <span className="balance-loading-dots" />
                    <span className="balance-loading-text">Loading…</span>
                  </div>
                ) : (
                  <div className="balance-amount">
                    {formatBalance(currentWallet.available)} USDT
                    {/* {formatBalance(activeTab === 'overview' ? totalOverviewBalance : currentWallet.available)} USDT */}
                  </div>
                )}
              </div>
              {!balanceLoading && (
                <div className="balance-metrics">
                  <div className="balance-change">
                    {formatBalance(currentWallet.locked)} USDT
                    {/* {formatBalance(activeTab === 'overview' ? totalOverviewLocked : currentWallet.locked)} USDT */}
                  </div>
                  <div className="balance-daily-pnl">
                    Locked Balance
                  </div>
                </div>
              )}
              {/* {!balanceLoading && (
                // {activeTab !== 'overview' && !balanceLoading && (
                <div className="balance-metrics">
                  <div
                    className="balance-change"
                    style={{ color: getChangeColor(currentWallet.change24h) }}
                  >
                    {getChangeIcon(currentWallet.change24h)} $
                    {formatBalance(Math.abs(currentWallet.change24h))} (
                    {currentWallet.change24h >= 0 ? "+" : ""}
                    {currentWallet.changePercent.toFixed(2)}%)
                  </div>
                  <div className="balance-daily-pnl">
                    ={formatBalance(currentWallet.dailyPnL ?? 0)} USD
                  </div>
                </div>
              )} */}
            </div>

            <div className="wallet-balance-transfer">
              <div
                className={`wallet-balance-transfer-actions${activeTab === "spot" ? " wallet-balance-transfer-actions--spot" : ""
                  }`}
              >
                <button
                  type="button"
                  className="transfer-button"
                  onClick={openTransferModal}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Transfer
                </button>
                {/* {activeTab === "spot" ? (
                  <button
                    type="button"
                    className="transfer-button transfer-button--deposit"
                    onClick={openDeposit}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21V8m0 0l4 4m-4-4l-4 4" />
                      <path d="M4 3h16" />
                    </svg>
                    Deposit
                  </button>
                ) : null} */}
                {activeTab === "spot" ? (
                  <button
                    type="button"
                    className="transfer-button transfer-button--withdraw"
                    onClick={openWithdrawModal}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v13m0 0l4-4m-4 4l-4-4" />
                      <path d="M4 21h16" />
                    </svg>
                    Withdraw
                  </button>
                ) : null}
              </div>
            </div>

            {/* <div className="wallet-balance-transfer">
              <button
                type="button"
                className="transfer-button"
                onClick={openTransferModal}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transfer
              </button>
            </div> */}
          </section>

          {/* ——— Chart (right) ——— */}
          <section className="wallet-chart-card" aria-labelledby="wallet-chart-heading">
            <div className="wallet-chart-card-header">
              <h2 id="wallet-chart-heading" className="wallet-chart-title">Portfolio performance</h2>
              <div className="chart-filters">
                {CHART_PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`chart-filter ${chartPeriod === period ? "active" : ""}`}
                    onClick={() => setChartPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="wallet-chart-content">
              <div className="chart-wrapper">
                {chartData.length === 0 ? (
                  <div className="wallet-chart-empty">
                    <span>No chart data</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 12, right: 12, left: 0, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient
                          id={`chartGradient-${activeTab}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="var(--text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="var(--text-tertiary)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => {
                          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
                          if (v >= 1) return `$${v.toFixed(2)}`;
                          if (v > 0) return `$${v.toFixed(4)}`;
                          return `$${Number(v).toFixed(2)}`;
                        }}
                        width={48}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={<ChartCursor />}
                        allowEscapeViewBox={{ x: false, y: false }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--brand-primary)"
                        strokeWidth={2}
                        fill={`url(#chartGradient-${activeTab})`}
                        activeDot={{ r: 5, fill: "var(--brand-primary)", stroke: "var(--bg-secondary)", strokeWidth: 2 }}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* {(activeTab === "crypto" || activeTab === "forex") && (
          <section
            className="wallet-trading-balance-section"
            aria-labelledby="wallet-trading-balance-heading"
          >
            <div className="wallet-trading-balance-header">
              <div className="wallet-trading-balance-header-text">
                <h2 id="wallet-trading-balance-heading" className="wallet-trading-balance-title">
                  {tradingSheet.title}
                </h2>
                <p className="wallet-trading-balance-sub">
                  Total available:{" "}
                  <strong>
                    {formatBalance(tradingTotalAvailable)} {tradingSheet.unit}
                  </strong>
                  {tradingSheet.loading && tradingSheet.rows.length > 0 ? (
                    <span className="wallet-trading-balance-updating"> · Updating…</span>
                  ) : null}
                </p>
              </div>
              {tradingSheet.refetch ? (
                <button
                  type="button"
                  className="wallet-trading-balance-refresh"
                  onClick={() => tradingSheet.refetch()}
                  disabled={tradingSheet.loading}
                  title="Refresh balances"
                  aria-label="Refresh balances"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={tradingSheet.loading ? "spin" : ""}
                    aria-hidden
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              ) : null}
            </div>

            {tradingSheet.loading && tradingSheet.rows.length === 0 ? (
              <div className="wallet-trading-balance-loading">
                <span className="wallet-trading-balance-spinner" aria-hidden />
                <span>Loading balances…</span>
              </div>
            ) : null}

            {tradingSheet.error ? (
              <div className="wallet-trading-balance-error" role="alert">
                <span>{tradingSheet.error}</span>
                {tradingSheet.refetch ? (
                  <button
                    type="button"
                    className="wallet-trading-balance-retry"
                    onClick={() => tradingSheet.refetch()}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}

            {!tradingSheet.loading && !tradingSheet.error && tradingSheet.rows.length === 0 ? (
              <div className="wallet-trading-balance-empty">No balance entries from trading API yet.</div>
            ) : null}

            {tradingSheet.rows.length > 0 ? (
              <>
                <div className="wallet-trading-balance-table-wrap">
                  <table className="wallet-trading-balance-table">
                    <thead>
                      <tr>
                        <th scope="col">Asset</th>
                        <th scope="col" className="wallet-tb-num">
                          Available
                        </th>
                        <th scope="col" className="wallet-tb-num">
                          Locked
                        </th>
                        <th scope="col" className="wallet-tb-num">
                          Total
                        </th>
                        <th scope="col" className="wallet-tb-num">
                          Est. value ({tradingSheet.unit})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradingSheet.rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="wallet-tb-asset">
                              <span className="wallet-tb-symbol">{row.symbol}</span>
                              <span className="wallet-tb-name">{row.name}</span>
                            </div>
                          </td>
                          <td className="wallet-tb-num">{formatBalance(row.available)}</td>
                          <td className="wallet-tb-num">{formatBalance(row.locked)}</td>
                          <td className="wallet-tb-num">{formatBalance(row.balance)}</td>
                          <td className="wallet-tb-num">{formatBalance(row.usdValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="wallet-trading-balance-cards" role="list">
                  {tradingSheet.rows.map((row) => (
                    <article key={`card-${row.id}`} className="wallet-trading-balance-card" role="listitem">
                      <div className="wallet-trading-balance-card-head">
                        <span className="wallet-card-symbol">{row.symbol}</span>
                        <span className="wallet-card-name">{row.name}</span>
                      </div>
                      <dl className="wallet-card-dl">
                        <div>
                          <dt>Available</dt>
                          <dd>
                            {formatBalance(row.available)} {tradingSheet.unit}
                          </dd>
                        </div>
                        <div>
                          <dt>Locked</dt>
                          <dd>
                            {formatBalance(row.locked)} {tradingSheet.unit}
                          </dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>
                            {formatBalance(row.balance)} {tradingSheet.unit}
                          </dd>
                        </div>
                        <div>
                          <dt>Est. value</dt>
                          <dd>
                            {formatBalance(row.usdValue)} {tradingSheet.unit}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        )} */}

        {/* Overview tab removed — keep markup below for reference only (disabled). */}
        {false && (
          <section
            className="wallet-overview-section"
            aria-labelledby="wallet-overview-heading"
          >
            <h2 id="wallet-overview-heading" className="wallet-overview-title">
              All Wallets
            </h2>
            <div className="wallet-overview-grid">
              <div className="wallet-overview-card wallet-overview-chart-card">
                <h3 className="wallet-overview-card-title">Allocation</h3>
                <div className="wallet-overview-chart-wrap">
                  {overviewPieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <Pie
                            data={overviewPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={56}
                            outerRadius={88}
                            paddingAngle={2}
                            isAnimationActive
                            animationDuration={400}
                          >
                            {overviewPieData.map((entry, idx) => (
                              <Cell
                                key={entry.name}
                                fill={entry.color}
                                stroke="var(--bg-secondary)"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              const total = overviewPieData.reduce((s, i) => s + i.value, 0);
                              const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                              return (
                                <div className="wallet-by-market-tooltip">
                                  <div className="wallet-by-market-tooltip-row">
                                    <span>{d.name}</span>
                                    <span>
                                      $
                                      {(d.value ?? 0).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                  <div className="wallet-by-market-tooltip-row">
                                    <span>Share</span>
                                    <span>{pct}%</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="wallet-overview-legend" role="list">
                        {overviewPieData.map((entry) => {
                          const total = overviewPieData.reduce((s, i) => s + i.value, 0);
                          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                          return (
                            <div key={entry.name} className="wallet-overview-legend-item" role="listitem">
                              <span className="wallet-overview-legend-dot" style={{ backgroundColor: entry.color }} aria-hidden />
                              <span className="wallet-overview-legend-name">{entry.name}</span>
                              <span className="wallet-overview-legend-pct">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="wallet-overview-empty">No balance across wallets</div>
                  )}
                </div>
              </div>
              <div className="wallet-overview-card wallet-overview-table-card">
                <h3 className="wallet-overview-card-title">Wallet breakdown</h3>
                <div className="wallet-overview-table-wrap">
                  <table className="wallet-overview-table" role="table" aria-label="Wallet breakdown">
                    <thead>
                      <tr>
                        <th scope="col">Wallet</th>
                        <th scope="col" className="wallet-overview-th-right">Balance</th>
                        <th scope="col" className="wallet-overview-th-right">Locked</th>
                        <th scope="col" className="wallet-overview-th-right">Share</th>
                        <th scope="col" className="wallet-overview-th-bar">Allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewWalletBreakdown.map((row) => (
                        <tr
                          key={row.key}
                          className="wallet-overview-row"
                          onClick={() => setActiveTab(row.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setActiveTab(row.key);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${row.label}: $${formatBalance(row.balance)} (${row.percentage.toFixed(1)}%). Click to view.`}
                        >
                          <td>
                            <span className="wallet-overview-dot" style={{ backgroundColor: row.color }} aria-hidden />
                            <span className="wallet-overview-wallet-name">{row.label}</span>
                          </td>
                          <td className="wallet-overview-td-right">
                            <span className="wallet-overview-balance">${formatBalance(row.available)}</span>
                          </td>
                          <td className="wallet-overview-td-right">
                            <span className="wallet-overview-balance">${formatBalance(row.locked)}</span>
                          </td>
                          <td className="wallet-overview-td-right">
                            <span className="wallet-overview-pct">{row.percentage.toFixed(1)}%</span>
                          </td>
                          <td className="wallet-overview-bar-cell">
                            <div className="wallet-overview-bar-bg" role="presentation">
                              <div
                                className="wallet-overview-bar-fill"
                                style={{
                                  width: `${Math.min(100, row.percentage)}%`,
                                  backgroundColor: row.color,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {showWalletByMarketSection && getBalanceHistoryWalletId(activeTab) != null && activeTab !== "spot" && (
          <section
            className="wallet-by-market-section wallet-balance-history-section"
            aria-labelledby="wallet-balance-history-heading"
          >
            <div className="wallet-transfer-history-card wallet-balance-history-card">
              <div className="wallet-transfer-history-card-header">
                <div className="wallet-transfer-history-card-heading">
                  <h2 id="wallet-balance-history-heading" className="wallet-transfer-history-card-title">
                    {activeTab === "spot" ? "Transfer history" : "Balance history"}
                  </h2>
                  <p className="wallet-transfer-history-subtitle">
                    {activeTab === "spot" ? (
                      <>
                        Transfers and ledger activity for your <strong>Spot wallet</strong> — amounts to 8 decimal
                        places.
                      </>
                    ) : (
                      <>
                        Ledger entries for <strong>{walletTypeLabel[activeTab] ?? activeTab}</strong> — amounts to 8
                        decimal places.
                      </>
                    )}
                  </p>
                </div>
                {getBalanceHistoryWalletId(activeTab) != null ? (
                  <button
                    type="button"
                    className="wallet-refresh-btn"
                    onClick={() => fetchWalletBalanceHistory(activeTab)}
                    disabled={balanceHistoryLoading}
                    title="Refresh balance history"
                    aria-label="Refresh balance history"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={balanceHistoryLoading ? "spin" : ""}
                      aria-hidden
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                ) : null}
              </div>

              <div className="wallet-transfer-history-card-body">
                {getBalanceHistoryWalletId(activeTab) != null && balanceHistoryError && (
                  <div className="wallet-transfer-history-error" role="alert">
                    <span>{balanceHistoryError}</span>
                    <button
                      type="button"
                      className="wallet-by-market-retry"
                      onClick={() => fetchWalletBalanceHistory(activeTab)}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {getBalanceHistoryWalletId(activeTab) != null &&
                  !balanceHistoryError &&
                  (balanceHistoryLoading || balanceHistory === null) && (
                    <div className="wallet-transfer-history-loading">
                      <span className="wallet-transfer-history-spinner" aria-hidden />
                      <span>Loading balance history…</span>
                    </div>
                  )}
                {getBalanceHistoryWalletId(activeTab) != null &&
                  !balanceHistoryLoading &&
                  !balanceHistoryError &&
                  balanceHistory !== null &&
                  transferHistoryRows != null &&
                  (balanceHistoryRawCount === 0 ? (
                    <div className="wallet-transfer-history-empty">
                      No balance history for this wallet yet.
                    </div>
                  ) : (
                    <>
                      <div className="wallet-bh-toolbar">
                        <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--filters">
                          <div className="wallet-bh-date-group">
                            <label className="wallet-bh-field">
                              <span className="wallet-bh-field-label">From</span>
                              <input
                                type="date"
                                className="wallet-bh-date-input"
                                value={balanceHistoryDateFrom}
                                max={balanceHistoryDateTo || toLocalISODate(new Date())}
                                onChange={(e) => setBalanceHistoryDateFrom(e.target.value)}
                              />
                            </label>
                            <label className="wallet-bh-field">
                              <span className="wallet-bh-field-label">To</span>
                              <input
                                type="date"
                                className="wallet-bh-date-input"
                                value={balanceHistoryDateTo}
                                min={balanceHistoryDateFrom || undefined}
                                max={toLocalISODate(new Date())}
                                onChange={(e) => setBalanceHistoryDateTo(e.target.value)}
                              />
                            </label>
                            <button
                              type="button"
                              className="wallet-bh-btn wallet-bh-btn--ghost"
                              onClick={() => {
                                setBalanceHistoryDateFrom("");
                                setBalanceHistoryDateTo("");
                              }}
                            >
                              Clear dates
                            </button>
                          </div>
                          <div className="wallet-bh-presets" role="group" aria-label="Quick date ranges">
                            <span className="wallet-bh-presets-label">Quick</span>
                            <button
                              type="button"
                              className="wallet-bh-chip"
                              onClick={() => applyBalanceHistoryPreset("7d")}
                            >
                              7 days
                            </button>
                            <button
                              type="button"
                              className="wallet-bh-chip"
                              onClick={() => applyBalanceHistoryPreset("30d")}
                            >
                              30 days
                            </button>
                            <button
                              type="button"
                              className="wallet-bh-chip"
                              onClick={() => applyBalanceHistoryPreset("month")}
                            >
                              This month
                            </button>
                            <button
                              type="button"
                              className="wallet-bh-chip"
                              onClick={() => applyBalanceHistoryPreset("all")}
                            >
                              All
                            </button>
                          </div>
                        </div>
                        <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--actions">
                          <label className="wallet-bh-field wallet-bh-field--inline">
                            <span className="wallet-bh-field-label">Rows / page</span>
                            <select
                              className="wallet-bh-select"
                              value={balanceHistoryPageSize}
                              onChange={(e) => setBalanceHistoryPageSize(Number(e.target.value))}
                            >
                              {BALANCE_HISTORY_PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="wallet-bh-range-meta" aria-live="polite">
                            {balanceHistoryRangeLabel}
                          </span>
                          <button
                            type="button"
                            className="wallet-bh-btn wallet-bh-btn--excel"
                            onClick={exportBalanceHistoryExcel}
                            disabled={balanceHistoryFilteredTotal === 0}
                            title="Export filtered rows to .xlsx (includes Summary sheet)"
                          >
                            <span className="wallet-bh-btn-icon" aria-hidden>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </span>
                            Download Excel
                          </button>
                        </div>
                      </div>
                      {balanceHistoryFilteredTotal === 0 ? (
                        <div className="wallet-transfer-history-empty wallet-bh-filter-empty" role="status">
                          No entries match the selected date range. Clear dates or choose &quot;All&quot; to see every
                          record.
                        </div>
                      ) : (
                        <>
                          <div className="wallet-transfer-history-table-wrap wallet-balance-history-table-wrap">
                            <table className="wallet-transfer-history-table wallet-balance-history-table">
                              <thead>
                                <tr>
                                  <th scope="col" className="wallet-bh-th-date">
                                    {"Date & time"}
                                  </th>
                                  <th scope="col" className="wallet-th-num wallet-bh-th-num">
                                    Amount
                                  </th>
                                  {/* <th scope="col" className="wallet-th-num wallet-bh-th-num">
                                    Minus (−)
                                  </th> */}
                                  <th scope="col" className="wallet-th-num wallet-bh-th-remain">
                                    Remaining
                                  </th>
                                  <th scope="col" className="wallet-bh-th-note" style={{ textAlign: "right" }}>
                                    Note
                                  </th>
                                  {/* <th scope="col" className="wallet-bh-th-account">
                                    Account
                                  </th> */}
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedBalanceHistoryRows.map((row, idx) => {
                                  const plus = balanceRowPlus(row);
                                  const minus = balanceRowMinus(row);
                                  const bal = transferRowBalanceAfter(row);
                                  const noteLabel = transferRowActivityNote(row);
                                  const account = transferRowWalletAccount(row);
                                  const accountMod = /^lock$/i.test(account)
                                    ? "lock"
                                    : /^main$/i.test(account)
                                      ? "main"
                                      : "other";
                                  const rowKey =
                                    row?.mid ??
                                    row?.id ??
                                    `p${balanceHistoryPageSafe}-${idx}-${transferRowTimeValue(row)?.getTime() ?? idx}`;
                                  return (
                                    <tr key={rowKey}>
                                      <td className="wallet-transfer-history-td-date wallet-bh-td-date">
                                        {transferRowDate(row)}
                                      </td>
                                      <td className="wallet-td-num wallet-transfer-history-td-amount wallet-bh-td-num">
                                        <span
                                          className={
                                            `wallet-transfer-type ${row?.classname} wallet-bh-amount-pill`
                                          }
                                        >
                                          {/* {formatHistoryNonZeroAmount(plus, hideBalance)} */}
                                          {formatBalance(row.balance)}
                                        </span>
                                      </td>
                                      {/* <td className="wallet-td-num wallet-transfer-history-td-amount wallet-bh-td-num">
                                        <span
                                          className={
                                            minus > 0
                                              ? "wallet-transfer-type wallet-transfer-type--debit wallet-bh-amount-pill"
                                              : "wallet-bh-dash"
                                          }
                                        >
                                          {formatHistoryNonZeroAmount(minus, hideBalance)}
                                        </span>
                                      </td> */}
                                      <td className="wallet-td-num wallet-transfer-history-td-balance wallet-bh-td-remain">
                                        <span className="wallet-bh-remain-value">
                                          {formatHistoryRemain(bal, hideBalance)}
                                        </span>
                                      </td>
                                      <td className="wallet-bh-td-note" style={{ textAlign: "right" }}>
                                        <span className="wallet-balance-history-note">{noteLabel}</span>
                                      </td>
                                      {/* <td className="wallet-bh-td-account">
                                        <span className={`wallet-bh-account-tag wallet-bh-account-tag--${accountMod}`}>
                                          {account}
                                        </span>
                                      </td> */}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <nav className="wallet-bh-pagination" aria-label="Balance history pagination">
                            <button
                              type="button"
                              className="wallet-bh-page-btn"
                              disabled={balanceHistoryPageSafe <= 1}
                              onClick={() => setBalanceHistoryPage((p) => Math.max(1, p - 1))}
                            >
                              Previous
                            </button>
                            <div className="wallet-bh-page-list">
                              {paginationWindow.map((item, wi) =>
                                item === "…" ? (
                                  <span key={`ellipsis-${wi}`} className="wallet-bh-page-ellipsis">
                                    …
                                  </span>
                                ) : (
                                  <button
                                    key={item}
                                    type="button"
                                    className={
                                      item === balanceHistoryPageSafe
                                        ? "wallet-bh-page-num is-active"
                                        : "wallet-bh-page-num"
                                    }
                                    onClick={() => setBalanceHistoryPage(item)}
                                    aria-current={item === balanceHistoryPageSafe ? "page" : undefined}
                                  >
                                    {item}
                                  </button>
                                )
                              )}
                            </div>
                            <button
                              type="button"
                              className="wallet-bh-page-btn"
                              disabled={balanceHistoryPageSafe >= balanceHistoryTotalPages}
                              onClick={() =>
                                setBalanceHistoryPage((p) => Math.min(balanceHistoryTotalPages, p + 1))
                              }
                            >
                              Next
                            </button>
                          </nav>
                        </>
                      )}
                    </>
                  ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "spot" ? (
          <section
            className="wallet-by-market-section wallet-spot-history-section"
            aria-labelledby="wallet-spot-history-heading"
          >
            <div className="wallet-transfer-history-card wallet-balance-history-card">
              <div className="wallet-transfer-history-card-header">
                <div className="wallet-transfer-history-card-heading">
                  <h2 id="wallet-spot-history-heading" className="wallet-transfer-history-card-title">
                    Wallet activity
                  </h2>
                  <p className="wallet-transfer-history-subtitle">{spotHistorySubtitle}</p>
                </div>
                <button
                  type="button"
                  className="wallet-refresh-btn"
                  onClick={refreshSpotHistory}
                  disabled={spotHistoryRefreshLoading}
                  title="Refresh history"
                  aria-label="Refresh history"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={spotHistoryRefreshLoading ? "spin" : ""}
                    aria-hidden
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
              </div>

              <div className="wallet-history-tabs" role="tablist" aria-label="Spot wallet history">
                {SPOT_HISTORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`spot-history-tab-${tab.id}`}
                    aria-selected={spotHistoryTab === tab.id}
                    aria-controls={`spot-history-panel-${tab.id}`}
                    className={`wallet-history-tab${spotHistoryTab === tab.id ? " active" : ""}`}
                    onClick={() => setSpotHistoryTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {spotHistoryTab === "transfer" ? (
              <div
                id="spot-history-panel-transfer"
                role="tabpanel"
                aria-labelledby="spot-history-tab-transfer"
                className="wallet-transfer-history-card-body"
              >
                {balanceHistoryError ? (
                  <div className="wallet-transfer-history-error" role="alert">
                    <span>{balanceHistoryError}</span>
                    <button
                      type="button"
                      className="wallet-by-market-retry"
                      onClick={() => fetchWalletBalanceHistory("spot")}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {!balanceHistoryError && (balanceHistoryLoading || balanceHistory === null) ? (
                  <div className="wallet-transfer-history-loading">
                    <span className="wallet-transfer-history-spinner" aria-hidden />
                    <span>Loading transfer history…</span>
                  </div>
                ) : null}
                {!balanceHistoryError &&
                !balanceHistoryLoading &&
                balanceHistory !== null &&
                transferHistoryRows != null &&
                balanceHistoryRawCount === 0 ? (
                  <div className="wallet-transfer-history-empty">No transfer history yet.</div>
                ) : null}
                {!balanceHistoryError &&
                !balanceHistoryLoading &&
                balanceHistory !== null &&
                transferHistoryRows != null &&
                balanceHistoryRawCount > 0 ? (
                  <>
                    <div className="wallet-bh-toolbar">
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--filters">
                        <div className="wallet-bh-date-group">
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">From</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={balanceHistoryDateFrom}
                              max={balanceHistoryDateTo || toLocalISODate(new Date())}
                              onChange={(e) => setBalanceHistoryDateFrom(e.target.value)}
                            />
                          </label>
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">To</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={balanceHistoryDateTo}
                              min={balanceHistoryDateFrom || undefined}
                              max={toLocalISODate(new Date())}
                              onChange={(e) => setBalanceHistoryDateTo(e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="wallet-bh-btn wallet-bh-btn--ghost"
                            onClick={() => {
                              setBalanceHistoryDateFrom("");
                              setBalanceHistoryDateTo("");
                            }}
                          >
                            Clear dates
                          </button>
                        </div>
                        <div className="wallet-bh-presets" role="group" aria-label="Quick date ranges">
                          <span className="wallet-bh-presets-label">Quick</span>
                          <button type="button" className="wallet-bh-chip" onClick={() => applyBalanceHistoryPreset("7d")}>
                            7 days
                          </button>
                          <button type="button" className="wallet-bh-chip" onClick={() => applyBalanceHistoryPreset("30d")}>
                            30 days
                          </button>
                          <button type="button" className="wallet-bh-chip" onClick={() => applyBalanceHistoryPreset("month")}>
                            This month
                          </button>
                          <button type="button" className="wallet-bh-chip" onClick={() => applyBalanceHistoryPreset("all")}>
                            All
                          </button>
                        </div>
                      </div>
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--actions">
                        <label className="wallet-bh-field wallet-bh-field--inline">
                          <span className="wallet-bh-field-label">Rows / page</span>
                          <select
                            className="wallet-bh-select"
                            value={balanceHistoryPageSize}
                            onChange={(e) => setBalanceHistoryPageSize(Number(e.target.value))}
                          >
                            {BALANCE_HISTORY_PAGE_SIZES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="wallet-bh-range-meta" aria-live="polite">
                          {balanceHistoryRangeLabel}
                        </span>
                        <button
                          type="button"
                          className="wallet-bh-btn wallet-bh-btn--excel"
                          onClick={exportBalanceHistoryExcel}
                          disabled={balanceHistoryFilteredTotal === 0}
                        >
                          Download Excel
                        </button>
                      </div>
                    </div>
                    {balanceHistoryFilteredTotal === 0 ? (
                      <div className="wallet-transfer-history-empty wallet-bh-filter-empty" role="status">
                        No entries match the selected date range.
                      </div>
                    ) : (
                      <>
                        <div className="wallet-transfer-history-table-wrap wallet-balance-history-table-wrap">
                          <table className="wallet-transfer-history-table wallet-balance-history-table">
                            <thead>
                              <tr>
                                <th scope="col" className="wallet-bh-th-date">Date & time</th>
                                <th scope="col" className="wallet-th-num wallet-bh-th-num">Amount</th>
                                <th scope="col" className="wallet-th-num wallet-bh-th-remain">Remaining</th>
                                <th scope="col" className="wallet-bh-th-note" style={{ textAlign: "right" }}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedBalanceHistoryRows.map((row, idx) => {
                                const bal = transferRowBalanceAfter(row);
                                const noteLabel = transferRowActivityNote(row);
                                const rowKey =
                                  row?.mid ??
                                  row?.id ??
                                  `p${balanceHistoryPageSafe}-${idx}-${transferRowTimeValue(row)?.getTime() ?? idx}`;
                                return (
                                  <tr key={rowKey}>
                                    <td className="wallet-transfer-history-td-date wallet-bh-td-date">
                                      {transferRowDate(row)}
                                    </td>
                                    <td className="wallet-td-num wallet-transfer-history-td-amount wallet-bh-td-num">
                                      <span className={`wallet-transfer-type ${row?.classname} wallet-bh-amount-pill`}>
                                        {formatBalance(row.balance)}
                                      </span>
                                    </td>
                                    <td className="wallet-td-num wallet-transfer-history-td-balance wallet-bh-td-remain">
                                      <span className="wallet-bh-remain-value">
                                        {formatHistoryRemain(bal, hideBalance)}
                                      </span>
                                    </td>
                                    <td className="wallet-bh-td-note" style={{ textAlign: "right" }}>
                                      <span className="wallet-balance-history-note">{noteLabel}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <nav className="wallet-bh-pagination" aria-label="Transfer history pagination">
                          <button
                            type="button"
                            className="wallet-bh-page-btn"
                            disabled={balanceHistoryPageSafe <= 1}
                            onClick={() => setBalanceHistoryPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </button>
                          <div className="wallet-bh-page-list">
                            {paginationWindow.map((item, wi) =>
                              item === "…" ? (
                                <span key={`spot-tr-ellipsis-${wi}`} className="wallet-bh-page-ellipsis">…</span>
                              ) : (
                                <button
                                  key={item}
                                  type="button"
                                  className={
                                    item === balanceHistoryPageSafe
                                      ? "wallet-bh-page-num is-active"
                                      : "wallet-bh-page-num"
                                  }
                                  onClick={() => setBalanceHistoryPage(item)}
                                  aria-current={item === balanceHistoryPageSafe ? "page" : undefined}
                                >
                                  {item}
                                </button>
                              )
                            )}
                          </div>
                          <button
                            type="button"
                            className="wallet-bh-page-btn"
                            disabled={balanceHistoryPageSafe >= balanceHistoryTotalPages}
                            onClick={() =>
                              setBalanceHistoryPage((p) => Math.min(balanceHistoryTotalPages, p + 1))
                            }
                          >
                            Next
                          </button>
                        </nav>
                      </>
                    )}
                  </>
                ) : null}
              </div>
              ) : null}

              {spotHistoryTab === "deposit" ? (
              <div
                id="spot-history-panel-deposit"
                role="tabpanel"
                aria-labelledby="spot-history-tab-deposit"
                className="wallet-transfer-history-card-body"
              >
                {depositHistoryError ? (
                  <div className="wallet-transfer-history-error" role="alert">
                    <span>{depositHistoryError}</span>
                    <button type="button" className="wallet-by-market-retry" onClick={fetchDepositHistory}>
                      Retry
                    </button>
                  </div>
                ) : null}

                {!depositHistoryError && depositHistoryLoading ? (
                  <div className="wallet-transfer-history-loading">
                    <span className="wallet-transfer-history-spinner" aria-hidden />
                    <span>Loading deposit history…</span>
                  </div>
                ) : null}

                {!depositHistoryError && !depositHistoryLoading && depositHistoryRows.length === 0 ? (
                  <div className="wallet-transfer-history-empty">No deposits yet.</div>
                ) : null}

                {!depositHistoryError && !depositHistoryLoading && depositHistoryRows.length > 0 ? (
                  <>
                    <div className="wallet-bh-toolbar">
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--filters">
                        <div className="wallet-bh-date-group">
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">From</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={depositHistoryDateFrom}
                              max={depositHistoryDateTo || toLocalISODate(new Date())}
                              onChange={(e) => setDepositHistoryDateFrom(e.target.value)}
                            />
                          </label>
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">To</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={depositHistoryDateTo}
                              min={depositHistoryDateFrom || undefined}
                              max={toLocalISODate(new Date())}
                              onChange={(e) => setDepositHistoryDateTo(e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="wallet-bh-btn wallet-bh-btn--ghost"
                            onClick={() => {
                              setDepositHistoryDateFrom("");
                              setDepositHistoryDateTo("");
                            }}
                          >
                            Clear dates
                          </button>
                        </div>
                      </div>
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--actions">
                        <label className="wallet-bh-field wallet-bh-field--inline">
                          <span className="wallet-bh-field-label">Rows / page</span>
                          <select
                            className="wallet-bh-select"
                            value={depositHistoryPageSize}
                            onChange={(e) => setDepositHistoryPageSize(Number(e.target.value))}
                          >
                            {BALANCE_HISTORY_PAGE_SIZES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="wallet-bh-range-meta" aria-live="polite">
                          {depositHistoryTotal === 0
                            ? "0 entries"
                            : `${depositHistoryOffset + 1}–${Math.min(
                                depositHistoryOffset + depositHistoryPageSize,
                                depositHistoryTotal
                              )} of ${depositHistoryTotal}`}
                        </span>
                        <button
                          type="button"
                          className="wallet-bh-btn wallet-bh-btn--excel"
                          onClick={exportDepositHistoryExcel}
                          disabled={depositHistoryTotal === 0}
                        >
                          Download Excel
                        </button>
                      </div>
                    </div>

                    {depositHistoryTotal === 0 ? (
                      <div className="wallet-transfer-history-empty wallet-bh-filter-empty" role="status">
                        No entries match the selected date range.
                      </div>
                    ) : (
                      <>
                        <div className="wallet-transfer-history-table-wrap wallet-balance-history-table-wrap">
                          <table className="wallet-transfer-history-table wallet-balance-history-table">
                            <thead>
                              <tr>
                                <th scope="col">Date & time</th>
                                <th scope="col">Invoice ID</th>
                                <th scope="col">Asset</th>
                                <th scope="col" className="wallet-th-num">Amount</th>
                                <th scope="col" style={{ textAlign: "left" }}>Status</th>
                                <th scope="col">Order No</th>
                                <th scope="col">Tran date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedDepositRows.map((row, idx) => (
                                <tr key={row?.id ?? row?.mid ?? `dep-${idx}`}>
                                  <td>{depositRowDate(row)}</td>
                                  <td className="wallet-transfer-ref">{String(row?.invoiceid ?? row?.invoice_id ?? "—")}</td>
                                  <td>{String(row?.asset ?? row?.coinname ?? "—").toUpperCase()}</td>
                                  <td className="wallet-td-num">{formatBalanceAmount(depositRowAmount(row), 4)}</td>
                                  <td style={{ textAlign: "left" }}>
                                    <span
                                      className="wallet-transfer-type wallet-transfer-type--other"
                                      style={{
                                        color: (() => {
                                          const st = depositRowStatus(row).toLowerCase();
                                          if (st.includes("confirm") || st.includes("success") || st.includes("complete")) {
                                            return "#22C55E";
                                          }
                                          if (st.includes("pending") || st.includes("wait") || st.includes("process")) {
                                            return "#F59E0B";
                                          }
                                          if (st.includes("reject") || st.includes("fail") || st.includes("cancel")) {
                                            return "#EF4444";
                                          }
                                          return "#9CA3AF";
                                        })(),
                                      }}
                                    >
                                      {depositRowStatus(row)}
                                    </span>
                                  </td>
                                  <td className="wallet-transfer-ref">
                                    <div className="wallet-address-wrap">
                                      <span>{String(row?.orderno ?? row?.order_no ?? "—")}</span>
                                      {row?.orderno ? (
                                        <button
                                          type="button"
                                          className="wallet-copy-icon-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copyWithdrawalAddress(row.orderno, "Order number copied.");
                                          }}
                                          title="Copy order number"
                                        >
                                          <Copy size={14} />
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td>{String(row?.trandate ?? "—")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <nav className="wallet-bh-pagination" aria-label="Deposit history pagination">
                          <button
                            type="button"
                            className="wallet-bh-page-btn"
                            disabled={depositHistoryPageSafe <= 1}
                            onClick={() => setDepositHistoryPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </button>
                          <div className="wallet-bh-page-list">
                            {depositPaginationWindow.map((item, wi) =>
                              item === "…" ? (
                                <span key={`dep-ellipsis-${wi}`} className="wallet-bh-page-ellipsis">
                                  …
                                </span>
                              ) : (
                                <button
                                  key={`dep-page-${item}`}
                                  type="button"
                                  className={
                                    item === depositHistoryPageSafe
                                      ? "wallet-bh-page-num is-active"
                                      : "wallet-bh-page-num"
                                  }
                                  onClick={() => setDepositHistoryPage(item)}
                                  aria-current={item === depositHistoryPageSafe ? "page" : undefined}
                                >
                                  {item}
                                </button>
                              )
                            )}
                          </div>
                          <button
                            type="button"
                            className="wallet-bh-page-btn"
                            disabled={depositHistoryPageSafe >= depositHistoryTotalPages}
                            onClick={() =>
                              setDepositHistoryPage((p) => Math.min(depositHistoryTotalPages, p + 1))
                            }
                          >
                            Next
                          </button>
                        </nav>
                      </>
                    )}
                  </>
                ) : null}
              </div>
              ) : null}

              {spotHistoryTab === "withdrawal" ? (
              <div
                id="spot-history-panel-withdrawal"
                role="tabpanel"
                aria-labelledby="spot-history-tab-withdrawal"
                className="wallet-transfer-history-card-body"
              >
                {withdrawalHistoryError ? (
                  <div className="wallet-transfer-history-error" role="alert">
                    <span>{withdrawalHistoryError}</span>
                    <button type="button" className="wallet-by-market-retry" onClick={fetchWithdrawalHistory}>
                      Retry
                    </button>
                  </div>
                ) : null}

                {!withdrawalHistoryError && withdrawalHistoryLoading ? (
                  <div className="wallet-transfer-history-loading">
                    <span className="wallet-transfer-history-spinner" aria-hidden />
                    <span>Loading withdrawal history…</span>
                  </div>
                ) : null}

                {!withdrawalHistoryError && !withdrawalHistoryLoading && withdrawalHistoryRows.length === 0 ? (
                  <div className="wallet-transfer-history-empty">No withdrawals yet.</div>
                ) : null}

                {!withdrawalHistoryError && !withdrawalHistoryLoading && withdrawalHistoryRows.length > 0 ? (
                  <>
                    <div className="wallet-bh-toolbar">
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--filters">
                        <div className="wallet-bh-date-group">
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">From</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={withdrawalHistoryDateFrom}
                              max={withdrawalHistoryDateTo || toLocalISODate(new Date())}
                              onChange={(e) => setWithdrawalHistoryDateFrom(e.target.value)}
                            />
                          </label>
                          <label className="wallet-bh-field">
                            <span className="wallet-bh-field-label">To</span>
                            <input
                              type="date"
                              className="wallet-bh-date-input"
                              value={withdrawalHistoryDateTo}
                              min={withdrawalHistoryDateFrom || undefined}
                              max={toLocalISODate(new Date())}
                              onChange={(e) => setWithdrawalHistoryDateTo(e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="wallet-bh-btn wallet-bh-btn--ghost"
                            onClick={() => {
                              setWithdrawalHistoryDateFrom("");
                              setWithdrawalHistoryDateTo("");
                            }}
                          >
                            Clear dates
                          </button>
                        </div>
                      </div>
                      <div className="wallet-bh-toolbar-row wallet-bh-toolbar-row--actions">
                        <label className="wallet-bh-field wallet-bh-field--inline">
                          <span className="wallet-bh-field-label">Rows / page</span>
                          <select
                            className="wallet-bh-select"
                            value={withdrawalHistoryPageSize}
                            onChange={(e) => setWithdrawalHistoryPageSize(Number(e.target.value))}
                          >
                            {BALANCE_HISTORY_PAGE_SIZES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="wallet-bh-range-meta" aria-live="polite">
                          {withdrawalHistoryTotal === 0
                            ? "0 entries"
                            : `${withdrawalHistoryOffset + 1}–${Math.min(
                              withdrawalHistoryOffset + withdrawalHistoryPageSize,
                              withdrawalHistoryTotal
                            )} of ${withdrawalHistoryTotal}`}
                        </span>
                        <button
                          type="button"
                          className="wallet-bh-btn wallet-bh-btn--excel"
                          onClick={exportWithdrawalHistoryExcel}
                          disabled={withdrawalHistoryTotal === 0}
                        >
                          Download Excel
                        </button>
                      </div>
                    </div>

                    <div className="wallet-transfer-history-table-wrap wallet-balance-history-table-wrap">
                      <table className="wallet-transfer-history-table wallet-balance-history-table">
                        <thead>
                          <tr>
                            <th scope="col">Date & time</th>
                            {/* <th scope="col">Coin</th> */}
                            <th scope="col">Network</th>
                            <th scope="col">Address</th>
                            <th scope="col">Txn Hash</th>
                            <th scope="col" className="wallet-th-num">Amount</th>
                            <th scope="col" style={{ textAlign: "right" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedWithdrawalRows.map((row, idx) => (
                            <tr key={row?.id ?? row?.mid ?? `wd-${idx}`}>
                              <td>{withdrawalRowDate(row)}</td>
                              {/* <td>{String(row?.coinname ?? row?.coin ?? "—").toUpperCase()}</td> */}
                              <td>{String(row?.network ?? "—").toUpperCase()}</td>
                              {/* <td className="wallet-transfer-ref" title={row?.address ?? ""}>
                                <button
                                  type="button"
                                  className="wallet-address-copy-btn"
                                  // onClick={() => copyWithdrawalAddress(row?.address)}
                                  onClick={() => {
                                    copyWithdrawalAddress(row?.address);

                                    const url = getExplorerUrl(row?.network, row?.address);

                                    if (url !== "#") {
                                      window.open(url, "_blank");
                                    }
                                  }}

                                  title="Copy address"
                                >
                                  {String(row?.subtoaddress ?? "—")}
                                </button>
                              </td> */}
                              <td className="wallet-transfer-ref" title={row?.address ?? ""}>
                                <div className="wallet-address-wrap">

                                  <span
                                    className="wallet-address-copy-btn"
                                    style={{ marginRight: "10px" }}
                                    onClick={() => {
                                      const url = getExplorerUrl(row?.network, row?.address);

                                      if (url !== "#") {
                                        window.open(url, "_blank");
                                      }
                                    }}
                                  >
                                    {String(row?.subtoaddress ?? "—")}
                                  </span>

                                  {row?.address && (
                                    <button
                                      type="button"
                                      className="wallet-copy-icon-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyWithdrawalAddress(row?.address, "Address copied.");
                                      }}
                                      title="Copy address"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="wallet-transfer-ref" title={row?.tranhash ?? ""}>
                                <div className="wallet-address-wrap">
                                  <span
                                    className="wallet-address-copy-btn"
                                    style={{ marginRight: "10px" }}
                                    onClick={() => {
                                      const url = getTransactionExplorerUrl(
                                        row?.network,
                                        row?.tranhash
                                      );

                                      if (url !== "#") {
                                        window.open(url, "_blank");
                                      }
                                    }}
                                  >
                                    {String(row?.subtranhash ?? "—")}
                                  </span>

                                  {row?.tranhash && (
                                    <button
                                      type="button"
                                      className="wallet-copy-icon-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyWithdrawalAddress(row?.tranhash, "Transaction hash copied.");
                                      }}
                                      title="Copy transaction hash"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  )}

                                  {/* <button
                                    type="button"
                                    className="wallet-copy-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyWithdrawalAddress(row?.tranhash);
                                    }}
                                    title="Copy transaction hash"
                                  >
                                    <Copy size={14} />
                                  </button> */}
                                </div>
                              </td>
                              <td className="wallet-td-num">{formatBalanceAmount(withdrawalRowAmount(row), 4)}</td>
                              <td style={{ textAlign: "right" }}>
                                <span className="wallet-transfer-type wallet-transfer-type--other"
                                  style={{
                                    color: (() => {
                                      const st = withdrawalRowStatus(row).toLowerCase();
                                      if (st.includes('confirm') || st.includes('success') || st.includes('complete')) return '#22C55E'; // green
                                      if (st.includes('pending') || st.includes('wait') || st.includes('process')) return '#F59E0B'; // yellow
                                      if (st.includes('reject') || st.includes('fail') || st.includes('cancel')) return '#EF4444'; // red
                                      return '#9CA3AF'; // gray
                                    })()
                                  }}>
                                  {withdrawalRowStatus(row)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <nav className="wallet-bh-pagination" aria-label="Withdrawal history pagination">
                      <button
                        type="button"
                        className="wallet-bh-page-btn"
                        disabled={withdrawalHistoryPageSafe <= 1}
                        onClick={() => setWithdrawalHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <div className="wallet-bh-page-list">
                        {withdrawalPaginationWindow.map((item, wi) =>
                          item === "…" ? (
                            <span key={`wd-ellipsis-${wi}`} className="wallet-bh-page-ellipsis">
                              …
                            </span>
                          ) : (
                            <button
                              key={`wd-page-${item}`}
                              type="button"
                              className={
                                item === withdrawalHistoryPageSafe
                                  ? "wallet-bh-page-num is-active"
                                  : "wallet-bh-page-num"
                              }
                              onClick={() => setWithdrawalHistoryPage(item)}
                              aria-current={item === withdrawalHistoryPageSafe ? "page" : undefined}
                            >
                              {item}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        className="wallet-bh-page-btn"
                        disabled={withdrawalHistoryPageSafe >= withdrawalHistoryTotalPages}
                        onClick={() =>
                          setWithdrawalHistoryPage((p) =>
                            Math.min(withdrawalHistoryTotalPages, p + 1)
                          )
                        }
                      >
                        Next
                      </button>
                    </nav>
                  </>
                ) : null}
              </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {showTransferModal && (
          <div
            className="modal-overlay"
            onClick={(e) => e.target === e.currentTarget && !transferLoading && closeTransferModal()}
          >
            <div
              className="transfer-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header walletmodalheader">
                <h3 className="modal-title">Transfer Funds</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeTransferModal}
                  disabled={transferLoading}
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-content" style={{ marginBottom: "0" }}>
                {/* {transferError && (
                  <div className="transfer-modal-error" role="alert">
                    {transferError}
                  </div>
                )} */}
                <div className="transfer-from-fixed">
                  <span className="transfer-label">From</span>
                  <span className="transfer-wallet-fixed">
                    {walletTypeLabel[transferFrom]}
                  </span>
                  <span className="transfer-balance">
                    Available: ${formatBalance(walletData[transferFrom]?.available ?? 0)}
                  </span>
                </div>
                <div className="transfer-select-group">
                  <label className="transfer-input-label">To</label>
                  <select
                    className="transfer-select"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    disabled={transferLoading}
                  >
                    {tabKeys
                      .filter((k) => {
                        if (transferFrom === "spot") {
                          return k !== "spot";
                        }
                        return k === "spot";
                      })
                      .map((k) => (
                        <option key={k} value={k}>
                          {walletTypeLabel[k]} — ${formatBalance(walletData[k]?.available ?? 0)}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="transfer-select-group">
                  <label className="transfer-input-label">Asset</label>
                  <select
                    className="transfer-select"
                    value={transferAsset}
                    onChange={(e) => setTransferAsset(e.target.value)}
                    disabled={transferLoading}
                  >
                    {TRANSFER_ASSETS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="transfer-input-group">
                  <label className="transfer-input-label">Amount</label>
                  <div className="transfer-input-wrapper">
                    <input
                      type="number"
                      className="transfer-input"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      min="0"
                      max={walletData[transferFrom]?.balance ?? 0}
                      step="0.01"
                      disabled={transferLoading}
                    />
                    <span className="transfer-currency">{transferAsset}</span>
                  </div>
                  {/* <div className="transfer-quick-amounts">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setTransferAmount(
                            ((walletData[transferFrom]?.balance ?? 0) * pct).toFixed(2),
                          )
                        }
                        disabled={transferLoading}
                      >
                        {pct === 1 ? "Max" : `${pct * 100}%`}
                      </button>
                    ))}
                  </div> */}
                </div>
                <div className="transfer-summary">
                  <div className="summary-item">
                    <span>Transfer Amount:</span>
                    <span>{transferAmount || "0.00"} {transferAsset}</span>
                  </div>
                  <div className="summary-item">
                    <span>Fee:</span>
                    <span style={{ color: "var(--color-success)" }}>Free</span>
                  </div>
                  <div className="summary-item total">
                    <span>You will receive:</span>
                    <span>{transferAmount || "0.00"} {transferAsset}</span>
                  </div>
                </div>
                <br />
                {transferError && (
                  <div className="transfer-modal-error" role="alert">
                    {transferError}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeTransferModal}
                  disabled={transferLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleTransfer}
                  disabled={
                    transferLoading ||
                    !transferAmount ||
                    parseFloat(transferAmount) <= 0 ||
                    transferFrom === transferTo
                  }
                >
                  {transferLoading ? (
                    <>
                      <span className="transfer-btn-spinner" />
                      Transferring…
                    </>
                  ) : (
                    "Confirm Transfer"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showWithdrawModal && (
          <div
            className="modal-overlay"
            onClick={(e) => e.target === e.currentTarget && closeWithdrawModal()}
          >
            <div className="transfer-modal transfer-modal--withdraw" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header walletmodalheader">
                <h3 className="modal-title">
                  {withdrawStep === "form" ? "Withdraw funds" : "Confirm withdrawal"}
                </h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeWithdrawModal}
                  disabled={withdrawSubmitting || beforeWithdrawLoading}
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="modal-content">
                <div className="withdraw-available-card">
                  <div className="withdraw-available-card__label">Available to withdraw</div>
                  <div className="withdraw-available-card__amount">
                    {formatBalanceAmount(currentWallet?.available ?? 0, 4)}
                    <span className="withdraw-available-card__unit">USDT</span>
                  </div>
                </div>

                {withdrawStep === "form" ? (
                  <>

                    <div className="transfer-select-group">
                      <label className="transfer-input-label">Network</label>
                      <select
                        className="transfer-select"
                        value={withdrawForm.network}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, network: e.target.value }))}
                        disabled={beforeWithdrawLoading || withdrawSubmitting}
                      >
                        <option value="">Select network</option>
                        {withdrawNetworkOptions.map((network) => (
                          <option key={network} value={network}>
                            {network}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="transfer-select-group">
                      <label className="transfer-input-label">Withdrawal address</label>
                      <input
                        type="text"
                        className="transfer-select"
                        value={withdrawForm.address}
                        onChange={(e) => setWithdrawForm((p) => ({ ...p, address: e.target.value }))}
                        placeholder="Paste destination wallet address"
                        disabled={beforeWithdrawLoading || withdrawSubmitting}
                      />
                      <small className="transfer-input-note">
                        Make sure address network matches selected network ({withdrawForm.network || "Network"}). Wrong network may cause permanent fund loss.
                      </small>
                    </div>

                    <div className="transfer-input-group">
                      <div className="transfer-input-label-row">
                        <label className="transfer-input-label">Amount</label>
                        <button
                          type="button"
                          className="transfer-max-btn"
                          onClick={() =>
                            setWithdrawForm((p) => ({
                              ...p,
                              // Keep raw numeric string for <input type="number"> (no commas/formatting).
                              amount: (() => {
                                const n = Number(currentWallet?.available ?? 0);
                                if (!Number.isFinite(n) || n <= 0) return "";
                                return n.toFixed(4);
                              })(),
                            }))
                          }
                          disabled={beforeWithdrawLoading || withdrawSubmitting}
                        >
                          Max
                        </button>
                      </div>
                      <div className="transfer-input-wrapper">
                        <input
                          type="number"
                          className="transfer-input"
                          placeholder="0.00"
                          value={withdrawForm.amount}
                          onChange={(e) => setWithdrawForm((p) => ({ ...p, amount: e.target.value }))}
                          min="0"
                          step="0.00000001"
                          disabled={beforeWithdrawLoading || withdrawSubmitting}
                        />
                        <span className="transfer-currency">{withdrawForm.coinname || "USDT"}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="transfer-summary withdraw-confirm-summary">
                      <div className="summary-item"><span>Coin</span><span>{withdrawForm.coinname}</span></div>
                      <div className="summary-item"><span>Network</span><span>{withdrawForm.network}</span></div>
                      <div className="summary-item"><span>Amount</span><span>{formatBalanceAmount(withdrawForm.amount, 4)}</span></div>
                      <div className="summary-item summary-item--address">
                        <span>Address</span>
                        <span title={withdrawForm.address}>{withdrawForm.address}</span>
                      </div>
                      {beforeWithdrawPreview?.fee != null && (
                        <div className="summary-item"><span>Fee</span><span>{beforeWithdrawPreview.fee}</span></div>
                      )}
                    </div>

                    <div className="transfer-select-group withdraw-otp-block">
                      <label className="transfer-input-label">OTP verification</label>
                      <OTPInput
                        value={withdrawForm.otp}
                        onChange={(v) => {
                          setWithdrawForm((p) => ({ ...p, otp: v }));
                          if (withdrawError) setWithdrawError("");
                        }}
                        onComplete={(v) => {
                          setWithdrawForm((p) => ({ ...p, otp: v }));
                          if (withdrawError) setWithdrawError("");
                          handleFinalWithdraw(v);
                        }}
                        disabled={withdrawSubmitting}
                        error={!!withdrawError}
                      />
                      <div className="withdraw-otp-resend-row">
                        <span className="withdraw-otp-timer">
                          {withdrawOtpResendSeconds > 0
                            ? `Resend available in 00:${String(withdrawOtpResendSeconds).padStart(2, "0")}`
                            : "Didn’t receive OTP?"}
                        </span>
                        <button
                          type="button"
                          className="wallet-bh-btn wallet-bh-btn--ghost withdraw-otp-resend-btn"
                          onClick={handleResendWithdrawOtp}
                          disabled={withdrawOtpResendSeconds > 0 || withdrawOtpResending || withdrawSubmitting}
                        >
                          {withdrawOtpResending ? "Resending…" : "Resend OTP"}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {withdrawError ? (
                  <div className="transfer-modal-error" role="alert">
                    {withdrawError}
                  </div>
                ) : null}
              </div>

              <div className="modal-actions">
                {withdrawStep === "otp" ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setWithdrawStep("form")}
                    disabled={withdrawSubmitting}
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeWithdrawModal}
                    disabled={withdrawSubmitting || beforeWithdrawLoading}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={withdrawStep === "form" ? handleBeforeWithdraw : handleFinalWithdraw}
                  disabled={withdrawSubmitting || beforeWithdrawLoading}
                >
                  {withdrawStep === "form"
                    ? beforeWithdrawLoading
                      ? "Validating…"
                      : "Continue"
                    : withdrawSubmitting
                      ? "Submitting…"
                      : "Confirm Withdraw"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* {showAssetDistribution && (
          <div className="asset-distribution-card">
            <div className="card-header">
              <h3 className="distribution-title">
                {activeTab === 'overview' ? "Overview Distribution" : "Asset Distribution"}
              </h3>
            </div>
            <div className="distribution-content">
              <div className="distribution-list">
                {!(currentWallet.assets?.length) ? (
                  <div className="distribution-empty">No assets</div>
                ) : (
                  currentWallet.assets.map((asset) => (
                    <div
                      key={asset.symbol}
                      className={`distribution-item ${selectedAsset === asset.symbol ? "selected" : ""}`}
                      onClick={() =>
                        setSelectedAsset(
                          selectedAsset === asset.symbol ? null : asset.symbol,
                        )
                      }
                    >
                      <div style={{
                        outline: `1px solid ${asset.border}`,
                        padding: "2px",
                        borderRadius: "50%"
                      }}>
                        <div
                          className="asset-color-indicator"
                          style={{
                            backgroundColor: asset.color,
                          }}
                        ></div>
                      </div>
                      <div className="asset-info">
                        <div className="asset-name">{asset.symbol}</div>
                        <div className="asset-full-name">{asset.name}</div>
                      </div>
                      <div className="asset-stats">
                        <div className="asset-percentage">{asset.percentage}%</div>
                        <div className="asset-value">
                          ${formatBalance(asset.usdValue)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="distribution-chart">
                {!(currentWallet.assets?.length) ? (
                  <div className="distribution-chart-empty">No data</div>
                ) : (
                  <div className="pie-chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={currentWallet.assets}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percentage }) =>
                            percentage > 5 ? `${percentage}%` : ""
                          }
                          outerRadius={110}
                          innerRadius={60}
                          fill="var(--brand-primary)"
                          dataKey="percentage"
                          activeIndex={activePieIndex}
                          activeShape={(props) => {
                            const {
                              cx,
                              cy,
                              innerRadius,
                              outerRadius,
                              startAngle,
                              endAngle,
                              fill,
                            } = props;
                            return (
                              <g>
                                <Sector
                                  cx={cx}
                                  cy={cy}
                                  innerRadius={innerRadius - 8}
                                  outerRadius={outerRadius + 15}
                                  startAngle={startAngle}
                                  endAngle={endAngle}
                                  fill={fill}
                                  style={{
                                    filter: isDark
                                      ? "drop-shadow(0 6px 12px rgba(0,0,0,0.4))"
                                      : "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
                                    transition: "all 0.3s ease",
                                  }}
                                />
                              </g>
                            );
                          }}
                          onMouseEnter={(_, index) => setActivePieIndex(index)}
                          onMouseLeave={() => setActivePieIndex(null)}
                          onClick={(data) => {
                            setSelectedAsset(
                              selectedAsset === data.symbol ? null : data.symbol,
                            );
                          }}
                          animationBegin={0}
                          animationDuration={1000}
                          animationEasing="ease-out"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {currentWallet.assets.map((asset, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={asset.color}
                              stroke={
                                selectedAsset === asset.symbol
                                  ? "var(--brand-primary)"
                                  : "transparent"
                              }
                              strokeWidth={selectedAsset === asset.symbol ? 3 : 0}
                              style={{
                                cursor: "pointer",
                                opacity:
                                  selectedAsset && selectedAsset !== asset.symbol
                                    ? 0.3
                                    : 1,
                                transition: "all 0.3s ease",
                                filter:
                                  activePieIndex === index
                                    ? "brightness(1.2)"
                                    : "brightness(1)",
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="pie-tooltip">
                                  <div className="tooltip-header">
                                    <div
                                      className="tooltip-color"
                                      style={{ backgroundColor: data.color }}
                                    ></div>
                                    <span className="tooltip-symbol">
                                      {data.symbol}
                                    </span>
                                  </div>
                                  <div className="tooltip-content">
                                    <div className="tooltip-row">
                                      <span>Name:</span>
                                      <span>{data.name}</span>
                                    </div>
                                    <div className="tooltip-row">
                                      <span>Percentage:</span>
                                      <span>{data.percentage}%</span>
                                    </div>
                                    <div className="tooltip-row">
                                      <span>Value:</span>
                                      <span>${formatBalance(data.usdValue)}</span>
                                    </div>
                                    {data.amount > 0 && (
                                      <div className="tooltip-row">
                                        <span>Amount:</span>
                                        <span>
                                          {data.amount.toFixed(4)} {data.symbol}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pie-center-content">
                      <div className="pie-center-label">Total</div>
                      <div className="pie-center-value">
                        ${formatBalance(currentWallet.balance)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default Wallet;
