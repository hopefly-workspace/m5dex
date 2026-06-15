/**
 * Connected Exchanges Component
 * Exchange connection management interface
 * Industry-level, pixel-perfect responsive design
 */

import { useState } from 'react';
import '../../styles/components/profile/ConnectedExchanges.css';
import CustomSelect from '../CustomSelect';

const ConnectedExchanges = () => {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTestResult, setShowTestResult] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiPassphrase, setApiPassphrase] = useState('');
  const [connectionLabel, setConnectionLabel] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [permissions, setPermissions] = useState({
    readBalances: true,
    placeOrders: true,
    futuresTrading: false,
    marginTrading: false,
  });
  const [testing, setTesting] = useState(false);

  // Mock data
  const overviewStats = {
    activeConnections: 3,
    totalBalance: '$125,486.50',
  };

  const connectedExchanges = [
    {
      id: 'binance-1',
      name: 'Binance',
      logo: 'B',
      logoColor: '#F0B90B',
      status: 'active',
      connectedAt: 'Jan 15, 2024',
      lastSync: '2 minutes ago',
      account: 'main_account@binance',
      apiKeyMasked: 'bk_***********4567',
      balance: '$85,234.50',
      assets: ['BTC', 'ETH', 'USDT', '+15 more'],
      permissions: {
        readBalances: true,
        placeOrders: true,
        withdrawals: false,
      },
      tradingPairs: '450+',
    },
    {
      id: 'coinbase-1',
      name: 'Coinbase Pro',
      logo: 'C',
      logoColor: '#0052FF',
      status: 'active',
      connectedAt: 'Dec 10, 2023',
      lastSync: '5 minutes ago',
      account: 'pro_account@coinbase',
      apiKeyMasked: 'cb_***********8901',
      balance: '$32,156.00',
      assets: ['BTC', 'ETH', 'SOL', '+8 more'],
      permissions: {
        readBalances: true,
        placeOrders: true,
        withdrawals: false,
      },
      tradingPairs: '200+',
    },
    {
      id: 'kraken-1',
      name: 'Kraken',
      logo: 'K',
      logoColor: '#584FBB',
      status: 'warning',
      connectedAt: 'Nov 20, 2023',
      lastSync: 'Failed',
      account: 'kraken_account',
      apiKeyMasked: 'kr_***********2345',
      balance: '$8,096.00 (Last known)',
      assets: ['BTC', 'ETH', 'XRP', '+5 more'],
      error: 'API key expired',
      tradingPairs: '150+',
    },
  ];

  const availableExchanges = [
    { id: 'kucoin', name: 'KuCoin', logo: 'K', color: '#26C18A' },
    { id: 'bitfinex', name: 'Bitfinex', logo: 'B', color: '#4A90E2' },
    { id: 'huobi', name: 'Huobi', logo: 'H', color: '#00D4FF' },
    { id: 'okx', name: 'OKX', logo: 'O', color: '#000000' },
    { id: 'bybit', name: 'Bybit', logo: 'B', color: '#F7A600' },
    { id: 'gateio', name: 'Gate.io', logo: 'G', color: '#6B5CE6' },
  ];

  const handleConnectExchange = (exchange) => {
    setSelectedExchange(exchange);
    setShowConnectModal(true);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    // Simulate API call
    setTimeout(() => {
      setTesting(false);
      setShowConnectModal(false);
      setShowTestResult(true);
    }, 2000);
  };

  const handleViewDetails = (exchange) => {
    setSelectedExchange(exchange);
    setShowDetailsModal(true);
    setActiveTab('overview');
  };

  const handleSync = (exchangeId) => {
    // TODO: Implement sync
  };

  const handleDisconnect = (exchangeId) => {
    // TODO: Implement disconnect with 2FA
  };

  return (
    <div className="connectedExchanges">
      {/* Header Section */}
      <div className="exchangesHeader">
        <div className="exchangesHeaderLeft">
          <h1 className="exchangesTitle">🔗 Connected Exchanges</h1>
          <p className="exchangesSubtitle">
            Trade across multiple exchanges from one platform
          </p>
        </div>
        <button 
          className="connectNewBtn"
          onClick={() => handleConnectExchange(null)}
        >
          Connect New +
        </button>
      </div>

      {/* Overview Stats */}
      <div className="exchangesOverview">
        <div className="overviewStat">
          <span className="statLabel">Active Connections:</span>
          <span className="statValue">{overviewStats.activeConnections}</span>
        </div>
        <div className="overviewStat">
          <span className="statLabel">Total Balance:</span>
          <span className="statValue">{overviewStats.totalBalance}</span>
        </div>
      </div>

      {/* Connected Exchanges List */}
      <div className="exchangesList">
        <h2 className="sectionTitle">Connected Exchanges</h2>
        {connectedExchanges.map((exchange) => (
          <div key={exchange.id} className={`exchangeCard ${exchange.status}`}>
            <div className="exchangeCardHeader">
              <div className="exchangeLogo" style={{ backgroundColor: exchange.logoColor + '20', color: exchange.logoColor }}>
                {exchange.logo}
              </div>
              <div className="exchangeInfo">
                <h3 className="exchangeName">{exchange.name}</h3>
                <div className="exchangeMeta">
                  <span>Connected: {exchange.connectedAt}</span>
                  <span>•</span>
                  <span>Last Sync: {exchange.lastSync}</span>
                </div>
              </div>
              <div className="exchangeStatus">
                {exchange.status === 'active' ? (
                  <span className="statusBadge active">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Active
                  </span>
                ) : (
                  <span className="statusBadge warning">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Warning
                  </span>
                )}
              </div>
            </div>

            <div className="exchangeCardBody">
              <div className="exchangeDetails">
                <div className="detailRow">
                  <span className="detailLabel">Account:</span>
                  <span className="detailValue">{exchange.account}</span>
                </div>
                <div className="detailRow">
                  <span className="detailLabel">API Key:</span>
                  <span className="detailValue">{exchange.apiKeyMasked}</span>
                </div>
                <div className="detailRow">
                  <span className="detailLabel">Balance:</span>
                  <span className="detailValue">{exchange.balance}</span>
                </div>
                <div className="detailRow">
                  <span className="detailLabel">Assets:</span>
                  <span className="detailValue">{exchange.assets.join(', ')}</span>
                </div>
              </div>

              {exchange.error && (
                <div className="exchangeError">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <strong>Connection Issue:</strong> {exchange.error}
                    <br />
                    Please reconnect to continue trading
                  </div>
                </div>
              )}

              <div className="exchangePermissions">
                <span className="permissionsLabel">Permissions:</span>
                <div className="permissionsList">
                  <span className={`permission ${exchange.permissions.readBalances ? 'enabled' : 'disabled'}`}>
                    {exchange.permissions.readBalances ? '✓' : '✗'} Read Balances
                  </span>
                  <span className={`permission ${exchange.permissions.placeOrders ? 'enabled' : 'disabled'}`}>
                    {exchange.permissions.placeOrders ? '✓' : '✗'} Place Orders
                  </span>
                  <span className={`permission ${exchange.permissions.withdrawals ? 'enabled' : 'disabled'}`}>
                    {exchange.permissions.withdrawals ? '✓' : '✗'} Withdrawals
                  </span>
                </div>
              </div>

              <div className="exchangeFooter">
                <div className="exchangeFooterLeft">
                  <span>Trading Pairs: {exchange.tradingPairs}</span>
                  <span className="statusDot">
                    <span className={`dot ${exchange.status}`}></span>
                    {exchange.status === 'active' ? 'Connected' : 'Needs Attention'}
                  </span>
                </div>
                <div className="exchangeActions">
                  {exchange.status === 'active' ? (
                    <>
                      <button className="actionBtn" onClick={() => handleSync(exchange.id)}>
                        Sync Now
                      </button>
                      <button className="actionBtn" onClick={() => handleViewDetails(exchange)}>
                        Edit
                      </button>
                      <button className="actionBtn" onClick={() => handleViewDetails(exchange)}>
                        View Details
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="actionBtn primary" onClick={() => handleConnectExchange(exchange)}>
                        Reconnect
                      </button>
                      <button className="actionBtn" onClick={() => handleViewDetails(exchange)}>
                        View Details
                      </button>
                    </>
                  )}
                  <button className="actionBtn danger" onClick={() => handleDisconnect(exchange.id)}>
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Available Exchanges */}
      <div className="availableExchanges">
        <h2 className="sectionTitle">Available Exchanges to Connect</h2>
        <div className="exchangesGrid">
          {availableExchanges.map((exchange) => (
            <div key={exchange.id} className="availableExchangeCard">
              <div className="availableExchangeLogo" style={{ backgroundColor: exchange.color + '20', color: exchange.color }}>
                {exchange.logo}
              </div>
              <h3 className="availableExchangeName">{exchange.name}</h3>
              <button 
                className="connectBtn"
                onClick={() => handleConnectExchange(exchange)}
              >
                Connect
              </button>
            </div>
          ))}
        </div>
        <a href="#all-exchanges" className="viewAllLink">
          View All 20+ Supported Exchanges →
        </a>
      </div>

      {/* Connect Exchange Modal */}
      {showConnectModal && (
        <div className="modalOverlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2 className="modalTitle">
                Connect Exchange - {selectedExchange?.name || 'Binance'}
              </h2>
              <button className="modalClose" onClick={() => setShowConnectModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modalBody">
              <div className="modalExchangeLogo" style={{ backgroundColor: (selectedExchange?.color || '#F0B90B') + '20', color: selectedExchange?.color || '#F0B90B' }}>
                {selectedExchange?.logo || 'B'}
              </div>

              <div className="modalSection">
                <h3 className="modalSectionTitle">Step 1: Get API Credentials from {selectedExchange?.name || 'Binance'}</h3>
                <div className="instructionsBox">
                  <p className="instructionsTitle">📚 How to create {selectedExchange?.name || 'Binance'} API keys:</p>
                  <ol className="instructionsList">
                    <li>Log in to {selectedExchange?.name || 'Binance'}</li>
                    <li>Go to Profile → API Management</li>
                    <li>Create new API key</li>
                    <li>Enable "Enable Reading" and "Enable Spot Trading"</li>
                    <li>DO NOT enable "Enable Withdrawals"</li>
                    <li>Add IP restrictions (recommended)</li>
                  </ol>
                  <a href="#" className="externalLink" target="_blank" rel="noopener noreferrer">
                    Open {selectedExchange?.name || 'Binance'} API Page →
                  </a>
                </div>
              </div>

              <div className="modalSection">
                <h3 className="modalSectionTitle">Step 2: Enter Your API Credentials</h3>
                
                <div className="formGroup">
                  <label className="formLabel">API Key *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="Paste your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                <div className="formGroup">
                  <label className="formLabel">API Secret *</label>
                  <div className="inputWithIcon">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      className="formInput"
                      placeholder="Paste your API secret"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                    />
                    <button 
                      className="inputIconBtn"
                      onClick={() => setShowSecret(!showSecret)}
                      type="button"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showSecret ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="formGroup">
                  <label className="formLabel">Connection Label (Optional)</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="My Binance Account"
                    value={connectionLabel}
                    onChange={(e) => setConnectionLabel(e.target.value)}
                  />
                </div>

                <div className="formGroup">
                  <label className="formLabel">Permissions (Select what this connection can do):</label>
                  <div className="permissionsCheckboxes">
                    <label className="checkboxLabel">
                      <input
                        type="checkbox"
                        checked={permissions.readBalances}
                        onChange={(e) => setPermissions({ ...permissions, readBalances: e.target.checked })}
                      />
                      <span>Read account balances</span>
                    </label>
                    <label className="checkboxLabel">
                      <input
                        type="checkbox"
                        checked={permissions.placeOrders}
                        onChange={(e) => setPermissions({ ...permissions, placeOrders: e.target.checked })}
                      />
                      <span>Place and cancel orders</span>
                    </label>
                    <label className="checkboxLabel">
                      <input
                        type="checkbox"
                        checked={permissions.futuresTrading}
                        onChange={(e) => setPermissions({ ...permissions, futuresTrading: e.target.checked })}
                      />
                      <span>Enable futures trading</span>
                    </label>
                    <label className="checkboxLabel">
                      <input
                        type="checkbox"
                        checked={permissions.marginTrading}
                        onChange={(e) => setPermissions({ ...permissions, marginTrading: e.target.checked })}
                      />
                      <span>Enable margin trading</span>
                    </label>
                  </div>
                </div>

                <div className="securityInfo">
                  <div className="securityItem">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Your API credentials are encrypted with AES-256</span>
                  </div>
                  <div className="securityItem">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>We never request withdrawal permissions</span>
                  </div>
                  <div className="securityItem">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>IP restrictions are recommended on exchange side</span>
                  </div>
                </div>
              </div>

              <div className="modalFooter">
                <button className="modalBtn secondary" onClick={() => setShowConnectModal(false)}>
                  Cancel
                </button>
                <button 
                  className="modalBtn primary"
                  onClick={handleTestConnection}
                  disabled={!apiKey || !apiSecret || testing}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Test Result Modal */}
      {showTestResult && (
        <div className="modalOverlay" onClick={() => setShowTestResult(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2 className="modalTitle">Testing Connection...</h2>
              <button className="modalClose" onClick={() => setShowTestResult(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modalBody">
              <div className="testSteps">
                <div className="testStep completed">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Validating API credentials</span>
                </div>
                <div className="testStep completed">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Checking permissions</span>
                </div>
                <div className="testStep completed">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Fetching account information</span>
                </div>
                <div className="testStep completed">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Syncing balances</span>
                </div>
              </div>

              <div className="testSuccess">
                <div className="successIcon">🎉</div>
                <h3 className="successTitle">Connection Successful!</h3>
              </div>

              <div className="testDetails">
                <h4 className="detailsTitle">Account Details:</h4>
                <div className="detailsList">
                  <div className="detailItem">
                    <span className="detailItemLabel">Exchange:</span>
                    <span className="detailItemValue">{selectedExchange?.name || 'Binance'}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailItemLabel">Account ID:</span>
                    <span className="detailItemValue">123456789</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailItemLabel">Total Balance:</span>
                    <span className="detailItemValue">$45,678.90</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailItemLabel">Available Assets:</span>
                    <span className="detailItemValue">12 coins</span>
                  </div>
                </div>

                <h4 className="detailsTitle">Permissions Verified:</h4>
                <div className="permissionsVerified">
                  <div className="permissionVerified">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>Read Balances</span>
                  </div>
                  <div className="permissionVerified">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>Place Orders</span>
                  </div>
                  <div className="permissionVerified disabled">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    <span>Withdrawals (Correctly disabled)</span>
                  </div>
                </div>
              </div>

              <div className="modalFooter">
                <button className="modalBtn primary" onClick={() => {
                  setShowTestResult(false);
                  // TODO: Actually connect the exchange
                }}>
                  Connect Exchange
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Details Modal */}
      {showDetailsModal && selectedExchange && (
        <div className="modalOverlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2 className="modalTitle">
                {selectedExchange.name} - Connection Details
              </h2>
              <button className="modalClose" onClick={() => setShowDetailsModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modalTabs">
              <button 
                className={`modalTab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`modalTab ${activeTab === 'balances' ? 'active' : ''}`}
                onClick={() => setActiveTab('balances')}
              >
                Balances
              </button>
              <button 
                className={`modalTab ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                Orders
              </button>
              <button 
                className={`modalTab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>

            <div className="modalBody">
              {activeTab === 'overview' && (
                <div className="tabContent">
                  <div className="overviewSection">
                    <h3 className="sectionSubtitle">Connection Status</h3>
                    <div className="statusInfo">
                      <div className="statusItem">
                        <span className="statusItemLabel">Connection Status:</span>
                        <span className="statusItemValue">
                          <span className="statusDot active"></span>
                          Active
                        </span>
                      </div>
                      <div className="statusItem">
                        <span className="statusItemLabel">Connected Since:</span>
                        <span className="statusItemValue">{selectedExchange.connectedAt}</span>
                      </div>
                      <div className="statusItem">
                        <span className="statusItemLabel">Last Successful Sync:</span>
                        <span className="statusItemValue">{selectedExchange.lastSync}</span>
                      </div>
                      <div className="statusItem">
                        <span className="statusItemLabel">Next Auto Sync:</span>
                        <span className="statusItemValue">In 3 minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3 className="sectionSubtitle">API Key Information</h3>
                    <div className="apiKeyInfo">
                      <div className="apiKeyRow">
                        <span className="apiKeyLabel">Key:</span>
                        <span className="apiKeyValue">{selectedExchange.apiKeyMasked}</span>
                        <button className="iconBtn">View</button>
                        <button className="iconBtn">Copy</button>
                      </div>
                      <div className="apiKeyRow">
                        <span className="apiKeyLabel">Created:</span>
                        <span className="apiKeyValue">{selectedExchange.connectedAt}</span>
                      </div>
                      <div className="apiKeyRow">
                        <span className="apiKeyLabel">IP Restrictions:</span>
                        <span className="apiKeyValue">192.168.1.100, 10.0.0.50</span>
                      </div>
                    </div>
                  </div>

                  <div className="overviewSection">
                    <h3 className="sectionSubtitle">Statistics (Last 30 Days)</h3>
                    <div className="statsGrid">
                      <div className="statCard">
                        <span className="statCardLabel">Total Trades</span>
                        <span className="statCardValue">245</span>
                      </div>
                      <div className="statCard">
                        <span className="statCardLabel">Volume Traded</span>
                        <span className="statCardValue">$125,000</span>
                      </div>
                      <div className="statCard">
                        <span className="statCardLabel">Success Rate</span>
                        <span className="statCardValue">99.2%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'balances' && (
                <div className="tabContent">
                  <div className="balancesHeader">
                    <div className="balanceSummary">
                      <div className="balanceItem">
                        <span className="balanceLabel">Total Balance:</span>
                        <span className="balanceValue">{selectedExchange.balance}</span>
                      </div>
                      <div className="balanceItem">
                        <span className="balanceLabel">Available:</span>
                        <span className="balanceValue">$82,100.00</span>
                      </div>
                      <div className="balanceItem">
                        <span className="balanceLabel">In Orders:</span>
                        <span className="balanceValue">$3,134.50</span>
                      </div>
                    </div>
                    <button className="syncBtn">Sync Balances Now</button>
                  </div>

                  <div className="balancesTable">
                    <div className="tableHeader">
                      <div className="tableCell">Asset</div>
                      <div className="tableCell">Amount</div>
                      <div className="tableCell">Value</div>
                      <div className="tableCell">Available</div>
                    </div>
                    <div className="tableRow">
                      <div className="tableCell">BTC</div>
                      <div className="tableCell">0.5234</div>
                      <div className="tableCell">$45,230</div>
                      <div className="tableCell">0.5000</div>
                    </div>
                    <div className="tableRow">
                      <div className="tableCell">ETH</div>
                      <div className="tableCell">12.456</div>
                      <div className="tableCell">$28,500</div>
                      <div className="tableCell">12.456</div>
                    </div>
                    <div className="tableRow">
                      <div className="tableCell">USDT</div>
                      <div className="tableCell">10,000</div>
                      <div className="tableCell">$10,000</div>
                      <div className="tableCell">9,800</div>
                    </div>
                    <div className="tableRow">
                      <div className="tableCell">BNB</div>
                      <div className="tableCell">25.5</div>
                      <div className="tableCell">$1,504.50</div>
                      <div className="tableCell">25.5</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="tabContent">
                  <div className="settingsSection">
                    <h3 className="sectionSubtitle">Auto-Sync Settings</h3>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Enable automatic balance syncing</span>
                        <span className="settingDesc">Automatically sync balances every 5 minutes</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                    <div className="settingItem">
                      <span className="settingLabel">Sync Interval:</span>
                      <CustomSelect className="selectInput">
                        <option>5 minutes</option>
                        <option>10 minutes</option>
                        <option>15 minutes</option>
                        <option>30 minutes</option>
                      </CustomSelect>
                    </div>
                  </div>

                  <div className="settingsSection">
                    <h3 className="sectionSubtitle">Trading Settings</h3>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Enable order placement</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Enable order cancellation</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Enable futures trading</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                  </div>

                  <div className="settingsSection">
                    <h3 className="sectionSubtitle">Notifications</h3>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Order fill notifications</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Balance change alerts</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                    <div className="settingItem">
                      <div className="settingInfo">
                        <span className="settingLabel">Connection error alerts</span>
                      </div>
                      <label className="toggleSwitch">
                        <input type="checkbox" defaultChecked />
                        <span className="toggleSlider" />
                      </label>
                    </div>
                  </div>

                  <div className="settingsSection dangerZone">
                    <h3 className="sectionSubtitle">Danger Zone</h3>
                    <div className="dangerActions">
                      <button className="dangerBtn">Disconnect Exchange</button>
                      <button className="dangerBtn">Delete Connection Data</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectedExchanges;

