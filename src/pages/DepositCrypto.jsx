/**
 * Deposit Crypto Page
 * Screen for depositing cryptocurrency with address display, QR code, and transaction history
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { copyToClipboard } from '../utils/clipboard';
import '../styles/pages/DepositCrypto.css';

// Popular cryptocurrencies
const cryptocurrencies = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', networks: ['bitcoin'] },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', networks: ['erc20'] },
  { symbol: 'USDT', name: 'Tether', icon: '₮', networks: ['trc20', 'erc20', 'bep20'] },
  { symbol: 'BNB', name: 'Binance Coin', icon: '🔷', networks: ['bep20'] },
  { symbol: 'USDC', name: 'USD Coin', icon: '💵', networks: ['erc20', 'bep20'] },
  { symbol: 'SOL', name: 'Solana', icon: '◎', networks: ['solana'] },
  { symbol: 'XRP', name: 'Ripple', icon: '✕', networks: ['ripple'] },
  { symbol: 'ADA', name: 'Cardano', icon: '₳', networks: ['cardano'] },
  { symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð', networks: ['dogecoin'] },
  { symbol: 'MATIC', name: 'Polygon', icon: '🔷', networks: ['erc20'] },
];

// Network configurations
const networkConfig = {
  bitcoin: { name: 'Bitcoin Network', confirmations: 1, minDeposit: '0.0001 BTC' },
  erc20: { name: 'ERC20', confirmations: 12, minDeposit: '0.001 ETH' },
  trc20: { name: 'TRC20', confirmations: 20, minDeposit: '1 USDT' },
  bep20: { name: 'BEP20', confirmations: 12, minDeposit: '0.001 BNB' },
  solana: { name: 'Solana Network', confirmations: 32, minDeposit: '0.01 SOL' },
  ripple: { name: 'Ripple Network', confirmations: 1, minDeposit: '10 XRP' },
  cardano: { name: 'Cardano Network', confirmations: 10, minDeposit: '1 ADA' },
  dogecoin: { name: 'Dogecoin Network', confirmations: 1, minDeposit: '1 DOGE' },
};

const DepositCrypto = () => {
  const navigate = useNavigate();
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('bitcoin');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  // Mock transaction history
  const [transactionHistory] = useState([
    {
      id: '1',
      time: '2024-01-15 14:30:25',
      amount: '0.5 BTC',
      txId: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
      status: 'Completed',
      confirmations: '12/12',
    },
    {
      id: '2',
      time: '2024-01-14 10:15:42',
      amount: '2.0 ETH',
      txId: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7',
      status: 'Pending',
      confirmations: '8/12',
    },
    {
      id: '3',
      time: '2024-01-13 18:45:10',
      amount: '1000 USDT',
      txId: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8',
      status: 'Completed',
      confirmations: '20/20',
    },
  ]);
  // Mock deposit address (in production, this would come from API)
  const depositAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
  const selectedCryptoData = cryptocurrencies.find(c => c.symbol === selectedCrypto);
  const currentNetwork = networkConfig[selectedNetwork];
  const availableNetworks = selectedCryptoData?.networks || [];

  // Filter cryptocurrencies based on search
  const filteredCryptos = cryptocurrencies.filter(crypto =>
    crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    crypto.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.crypto-dropdown') && !event.target.closest('.network-dropdown')) {
        setShowCryptoDropdown(false);
        setShowNetworkDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle crypto selection
  const handleCryptoSelect = (crypto) => {
    setSelectedCrypto(crypto.symbol);
    // Auto-select first available network
    if (crypto.networks.length > 0) {
      setSelectedNetwork(crypto.networks[0]);
    }
    setShowCryptoDropdown(false);
    setSearchQuery('');
  };

  // Handle network selection
  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    setShowNetworkDropdown(false);
  };

  // Copy address to clipboard (works on HTTP & HTTPS)
  const handleCopyAddress = async () => {
    try {
      await copyToClipboard(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Share QR code
  const handleShareQR = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Deposit ${selectedCrypto} Address`,
          text: `My ${selectedCrypto} deposit address: ${depositAddress}`,
        });
      } else {
        // Fallback: copy address
        handleCopyAddress();
      }
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  // Get blockchain explorer URL
  const getExplorerUrl = () => {
    const baseUrls = {
      bitcoin: `https://blockstream.info/address/${depositAddress}`,
      erc20: `https://etherscan.io/address/${depositAddress}`,
      trc20: `https://tronscan.org/#/address/${depositAddress}`,
      bep20: `https://bscscan.com/address/${depositAddress}`,
      solana: `https://solscan.io/account/${depositAddress}`,
      ripple: `https://xrpscan.com/account/${depositAddress}`,
      cardano: `https://cardanoscan.io/address/${depositAddress}`,
      dogecoin: `https://dogechain.info/address/${depositAddress}`,
    };
    return baseUrls[selectedNetwork] || '#';
  };

  return (
    <div className="deposit-crypto-page">
      {/* Header Section */}
      <div className="deposit-header">
        <div className="deposit-header-left">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="deposit-title">Deposit Crypto</h1>
        </div>
        <button
          className="close-button"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="deposit-container">
        {/* Selection Row - Compact */}
        <div className="selection-row">
          <div className="selection-group">
            <label className="deposit-label">Cryptocurrency</label>
            <div className="crypto-dropdown">
              <button
                className="dropdown-trigger compact"
                onClick={() => {
                  setShowCryptoDropdown(!showCryptoDropdown);
                  setShowNetworkDropdown(false);
                }}
              >
                <div className="dropdown-selected">
                  <span className="crypto-icon">{selectedCryptoData?.icon}</span>
                  <span className="crypto-symbol">{selectedCrypto}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showCryptoDropdown && (
                <div className="dropdown-menu">
                  <div className="dropdown-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <div className="dropdown-list">
                    {filteredCryptos.map((crypto) => (
                      <button
                        key={crypto.symbol}
                        className={`dropdown-item ${selectedCrypto === crypto.symbol ? 'active' : ''}`}
                        onClick={() => handleCryptoSelect(crypto)}
                      >
                        <span className="crypto-icon">{crypto.icon}</span>
                        <div className="crypto-info">
                          <span className="crypto-symbol">{crypto.symbol}</span>
                          <span className="crypto-name">{crypto.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="selection-group">
            <label className="deposit-label">Network</label>
            <div className="network-dropdown">
              <button
                className="dropdown-trigger compact"
                onClick={() => {
                  setShowNetworkDropdown(!showNetworkDropdown);
                  setShowCryptoDropdown(false);
                }}
                disabled={availableNetworks.length === 0}
              >
                <div className="dropdown-selected">
                  <span className="network-name">{currentNetwork?.name || 'Select Network'}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showNetworkDropdown && availableNetworks.length > 0 && (
                <div className="dropdown-menu">
                  <div className="dropdown-list">
                    {availableNetworks.map((network) => (
                      <button
                        key={network}
                        className={`dropdown-item ${selectedNetwork === network ? 'active' : ''}`}
                        onClick={() => handleNetworkSelect(network)}
                      >
                        <span className="network-name">{networkConfig[network]?.name}</span>
                        {selectedNetwork === network && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedCrypto && currentNetwork && (
          <div className="network-warning compact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Select correct network. Wrong network = permanent loss.</span>
          </div>
        )}

        {/* Deposit Address Display - Two Column Layout */}
        {selectedCrypto && selectedNetwork && (
          <>
            <div className="deposit-main-grid">
              {/* Left Column - QR Code & Address */}
              <div className="deposit-left-col">
                <div className="deposit-section compact">
                  <div className="qr-code-container">
                    <div className="qr-code-wrapper">
                      <div className="qr-code-border-pattern"></div>
                      <div className="qr-code-inner">
                        <QRCodeSVG
                          value={depositAddress}
                          size={200}
                          level="H"
                          includeMargin={true}
                          className="qr-code"
                          fgColor="#000000"
                          bgColor="#FFFFFF"
                        />
                      </div>
                      <div className="qr-code-corner qr-corner-tl"></div>
                      <div className="qr-code-corner qr-corner-tr"></div>
                      <div className="qr-code-corner qr-corner-bl"></div>
                      <div className="qr-code-corner qr-corner-br"></div>
                    </div>
                    <p className="qr-code-hint">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      Scan QR code to copy address
                    </p>
                  </div>

                  <div className="address-section">
                    <label className="deposit-label">Deposit Address</label>
                    <div className="address-input-group">
                      <input
                        type="text"
                        value={depositAddress}
                        readOnly
                        className="address-input"
                      />
                      <button
                        className="copy-button"
                        onClick={handleCopyAddress}
                        aria-label="Copy address"
                      >
                        {copied ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {copied && <span className="copy-feedback">Copied!</span>}
                  </div>

                  <div className="min-deposit-info compact">
                    <div className="info-row">
                      <span className="info-label">Min Deposit</span>
                      <span className="info-value">{currentNetwork?.minDeposit}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="deposit-actions compact">
                  <button className="btn-primary" onClick={handleCopyAddress}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copy
                  </button>
                  <button className="btn-secondary" onClick={handleShareQR}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                    </svg>
                    Share
                  </button>
                  <a
                    href={getExplorerUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                    Explorer
                  </a>
                </div>
              </div>

              {/* Right Column - Info & Instructions */}
              <div className="deposit-right-col">
                <div className="deposit-section compact important-instructions">
                  <div className="instructions-header compact">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3>Important</h3>
                  </div>
                  <ul className="instructions-list compact">
                    <li>Send only <strong>{selectedCrypto}</strong> to this address</li>
                    <li>Wrong asset = permanent loss</li>
                    <li>Confirmations: <strong>{currentNetwork?.confirmations} blocks</strong></li>
                    <li>Address can be reused</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Transaction History - Collapsible */}
            <div className="deposit-section transaction-history compact">
              <button
                className="section-toggle"
                onClick={() => setShowTransactionHistory(!showTransactionHistory)}
              >
                <h3 className="section-title">Recent Deposits</h3>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={showTransactionHistory ? 'rotated' : ''}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showTransactionHistory && (
                <div className="transaction-table">
                  <div className="transaction-header">
                    <div className="col-time">Time</div>
                    <div className="col-amount">Amount</div>
                    <div className="col-txid">TX ID</div>
                    <div className="col-status">Status</div>
                    <div className="col-confirmations">Confirms</div>
                  </div>
                  <div className="transaction-body">
                    {transactionHistory.length > 0 ? (
                      transactionHistory.map((tx) => (
                        <div key={tx.id} className="transaction-row">
                          <div className="col-time">
                            <div className="time-display">
                              <span className="time-value">{tx.time.split(' ')[1]}</span>
                              <span className="time-date">{tx.time.split(' ')[0]}</span>
                            </div>
                          </div>
                          <div className="col-amount">
                            <span className="amount-value">{tx.amount}</span>
                          </div>
                          <div className="col-txid">
                            <button
                              className="txid-link"
                              onClick={() => window.open(getExplorerUrl().replace('address', 'tx').replace(depositAddress, tx.txId), '_blank')}
                              title="View on blockchain explorer"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                              </svg>
                              {tx.txId.substring(0, 8)}...{tx.txId.substring(tx.txId.length - 8)}
                            </button>
                          </div>
                          <div className="col-status">
                            <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                              <span className="status-dot"></span>
                              {tx.status}
                            </span>
                          </div>
                          <div className="col-confirmations">
                            <div className="confirmations-display">
                              <span className="confirmations-value">{tx.confirmations}</span>
                              {tx.status === 'Pending' && (
                                <div className="confirmations-progress">
                                  <div className="progress-bar" style={{ width: `${(parseInt(tx.confirmations.split('/')[0]) / parseInt(tx.confirmations.split('/')[1])) * 100}%` }}></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="transaction-empty">
                        <p>No recent deposits</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DepositCrypto;

