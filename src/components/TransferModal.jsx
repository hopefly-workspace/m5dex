/**
 * Transfer Modal – Transfer between any wallet (Spot, Crypto, Forex, Indian).
 * One side default Spot; other side 3 market wallets. Swap allowed. Dono side same kabhi nahi.
 * USDT icon. Success/failed toast. Theme colors & fonts.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { api } from '../services/api';
import { formatNumber } from '../utils/helper';
import {
  WALLET_TYPE_LABELS,
  TRANSFER_WALLET_KEYS,
  TRANSFER_COINS,
  getEmptyWalletData,
} from '../services/walletApi';
import { useToast } from '../contexts/ToastContext';
import '../styles/components/TransferModal.css';

const MIN_AMOUNT = 0.00000001;

/** USDT (Tether) logo – teal diamond with T */
const USDTIcon = ({ size = 24, className = '' }) => (
  <span className={className} aria-hidden style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0 }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L22 8v8L12 22L2 16V8L12 2Z" fill="url(#tfm-usdt-a)" />
      <path d="M12 6v1.5h4.5V10H12v.5h4.5v2.5H12V17h-1V13H6.5v-2.5H11V10H6.5V7.5H11V6h1z" fill="white" />
      <defs>
        <linearGradient id="tfm-usdt-a" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#26A17B" />
          <stop offset="1" stopColor="#2EA57F" />
        </linearGradient>
      </defs>
    </svg>
  </span>
);

export default function TransferModal({ walletData = getEmptyWalletData(), onClose, onSuccess, isOpen }) {
  const { showSuccess, showError } = useToast();
  const [fromKey, setFromKey] = useState('spot');
  const [toKey, setToKey] = useState('crypto');
  const [coin, setCoin] = useState(TRANSFER_COINS[0]?.symbol ?? 'USDT');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fromWallet = walletData[fromKey];
  const toWallet = walletData[toKey];
  const availableBalance = fromWallet != null ? Number(fromWallet.available ?? 0) : 0;
  const hasNoBalance = availableBalance <= 0;

  /** From: any wallet (except current To so they stay different) */
  const fromOptions = useMemo(() => {
    return TRANSFER_WALLET_KEYS.filter((k) => k !== toKey && walletData[k] != null);
  }, [toKey, walletData]);

  /**
   * To options by rule:
   * - From Spot → can transfer to Crypto, Forex, Indian (any market wallet)
   * - From Crypto/Forex/Indian → can transfer only to Spot
   */
  const toOptions = useMemo(() => {
    const available = TRANSFER_WALLET_KEYS.filter((k) => walletData[k] != null);
    if (fromKey === 'spot') {
      return available.filter((k) => k !== 'spot');
    }
    return available.filter((k) => k === 'spot');
  }, [fromKey, walletData]);

  /** Modal open: reset From=Spot, To=first allowed (Spot → first market wallet) */
  useEffect(() => {
    if (!isOpen) return;
    setFromKey('spot');
    const allowedTo = TRANSFER_WALLET_KEYS.filter((k) => k !== 'spot' && walletData[k] != null);
    setToKey(allowedTo[0] || 'crypto');
  }, [isOpen]);

  /** Keep To valid: never same as From, and must be in allowed toOptions */
  useEffect(() => {
    if (toOptions.length && !toOptions.includes(toKey)) {
      setToKey(toOptions[0]);
    }
    if (fromKey === toKey && toOptions.length) {
      setToKey(toOptions[0]);
    }
  }, [fromKey, toKey, toOptions]);

  const swapFromTo = useCallback(() => {
    setFromKey((prev) => toKey);
    setToKey((prev) => fromKey);
    setAmount('');
    setError(null);
  }, [fromKey, toKey]);

  const setMaxAmount = useCallback(() => {
    if (availableBalance > 0) {
      // Strip commas so parseFloat doesn't stop at the first comma
      setAmount(String(formatNumber(availableBalance, 8)).replace(/,/g, ''));
      setError(null);
    }
  }, [availableBalance]);

  const handleConfirm = useCallback(async () => {
    const num = parseFloat(amount);
    if (!amount || Number.isNaN(num) || num < MIN_AMOUNT) {
      setError('Please enter a valid amount.');
      return;
    }
    if (fromKey === toKey) {
      setError('From and To wallets must be different.');
      return;
    }
    if (!fromWallet?.walletid || !toWallet?.walletid) {
      setError('Wallet information is missing. Please refresh.');
      return;
    }
    if (num > availableBalance) {
      setError('Insufficient balance.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/wallet/transfer', {
        from: fromWallet.walletid,
        to: toWallet.walletid,
        asset: coin,
        amount: num,
      });
      const successMsg = `${formatNumber(num)} ${coin} transferred successfully.`;
      showSuccess(successMsg, 4000);
      setAmount('');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = err?.message || err?.data?.message || 'Transfer failed. Please try again.';
      setError(msg);
      showError(msg, 5000);
    } finally {
      setLoading(false);
    }
  }, [amount, fromKey, toKey, fromWallet, toWallet, availableBalance, coin, onSuccess, onClose, showSuccess, showError]);

  const isConfirmDisabled =
    loading ||
    !amount ||
    parseFloat(amount) <= 0 ||
    fromKey === toKey ||
    hasNoBalance;

  if (!isOpen) return null;

  return (
    <div
      className="tfm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tfm-title"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose?.()}
    >
      <div className="tfm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tfm-header">
          <h2 id="tfm-title" className="tfm-title">
            Transfer
          </h2>
          <div className="tfm-header-actions">
            {/* <button type="button" className="tfm-icon-btn" aria-label="Open in new window">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button> */}
            <button
              type="button"
              className="tfm-icon-btn tfm-close"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="tfm-body">
          <div className="tfm-from-to-row">
            <div className="tfm-field tfm-field--half">
              <label className="tfm-label">From</label>
              <select
                className="tfm-select"
                value={fromKey}
                onChange={(e) => {
                  const nextFrom = e.target.value;
                  setFromKey(nextFrom);
                  setAmount('');
                  setError(null);
                  // Spot → any market; Crypto/Forex/Indian → only Spot
                  const allowedTo = nextFrom === 'spot'
                    ? TRANSFER_WALLET_KEYS.filter((k) => k !== 'spot' && walletData[k] != null)
                    : walletData.spot != null ? ['spot'] : [];
                  setToKey(allowedTo[0] || 'spot');
                }}
                disabled={loading}
                aria-describedby={error ? 'tfm-error' : undefined}
              >
                {fromOptions.map((k) => (
                  <option key={k} value={k}>
                    {WALLET_TYPE_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
            <div className="tfm-swap-wrap">
              <button
                type="button"
                className="tfm-swap-btn"
                onClick={swapFromTo}
                disabled={loading}
                aria-label="Swap From and To"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>
            <div className="tfm-field tfm-field--half">
              <label className="tfm-label">To</label>
              <select
                className="tfm-select"
                value={toKey}
                onChange={(e) => {
                  setToKey(e.target.value);
                  setError(null);
                }}
                disabled={loading}
              >
                {toOptions.map((k) => (
                  <option key={k} value={k}>
                    {WALLET_TYPE_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tfm-field">
            <label className="tfm-label">Coin</label>
            <div className="tfm-coin-select">
              <USDTIcon size={24} className="tfm-coin-icon-usdt" />
              <select
                className="tfm-select tfm-coin-select-inner"
                value={coin}
                onChange={(e) => {
                  setCoin(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                aria-describedby={error || hasNoBalance ? 'tfm-error' : undefined}
              >
                {TRANSFER_COINS.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.symbol} {c.name}
                  </option>
                ))}
              </select>
              <span className="tfm-chevron" aria-hidden />
            </div>
            {(error || hasNoBalance) && (
              <p className="tfm-coin-hint" id="tfm-error" role="alert">
                {error || 'No amount available to transfer, please select another coin.'}
              </p>
            )}
          </div>

          <div className="tfm-field">
            <label className="tfm-label">Amount</label>
            <div className="tfm-amount-wrap">
              <input
                type="text"
                inputMode="decimal"
                className="tfm-input"
                placeholder={`Minimum ${MIN_AMOUNT}`}
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                    setError(null);
                  }
                }}
                disabled={loading}
                aria-describedby="tfm-available"
              />
              <span className="tfm-amount-unit">{coin}</span>
              <button
                type="button"
                className="tfm-max-btn"
                onClick={setMaxAmount}
                disabled={loading || hasNoBalance}
              >
                MAX
              </button>
            </div>
            <div className="tfm-available-row" id="tfm-available">
              <span className="tfm-available-label">Available</span>
              <span className="tfm-available-value">
                {formatNumber(availableBalance)} {coin}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="tfm-confirm"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {loading ? (
              <>
                <span className="tfm-spinner" aria-hidden />
                Transferring…
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
