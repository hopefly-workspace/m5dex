import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/Header';
import AmountScreen from '../components/payment/AmountScreen';
import PaymentScreen from '../components/payment/PaymentScreen';
import CustomSelect from '../components/CustomSelect';
import '../styles/pages/PayThroughDeposit.css';
import * as XLSX from 'xlsx';
import { useLetsPay } from '../hooks/useLetsPay';
import { useUser } from '../contexts/UserContext';
import CryptoDeposit from '../components/payment/CryptoDeposit';
import { Copy } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const PayThroughDeposit = () => {
  const navigate = useNavigate();
  const scriptsLoadedRef = useRef(false);
  const observerRef = useRef(null);
  const { user } = useUser();
  const { showSuccess, showError } = useToast();
  const [showTransactionHistory, setShowTransactionHistory] = useState(true);

  const copyOrderNo = async (orderno) => {
    if (!orderno) return;
    try {
      await copyToClipboard(orderno);
      showSuccess('Order No. copied!');
    } catch {
      showError('Failed to copy');
    }
  };

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  // Flow states: 'amount' → 'payment' → 'success' | 'failed'
  const [currentStep, setCurrentStep] = useState('payment');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [errorMessage, setErrorMessage] = useState({
    amount: "",
    network: ""
  });
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'ondate', direction: 'desc' });
  const [depositHistory, setDepositHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showLetsPay, setShowLetsPay] = useState(false);
  // const letspayInitializedRef = useRef(false);
  const [initError, setInitError] = useState(null);
  const [isLaunchingScript, setIsLaunchingScript] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  useEffect(() => {
    const step = Number(localStorage.getItem('crypto_deposit_step'));
    const paymentData = localStorage.getItem('crypto_deposit_paymentData');

    if (step === 3 && paymentData) {
      setIsDepositModalOpen(true);
    }

    setIsReady(true);
  }, []);


  // const [isDepositModalOpen, setIsDepositModalOpen] = useState(() => {
  //   const step = Number(localStorage.getItem('crypto_deposit_step'));
  //   const paymentData = localStorage.getItem('crypto_deposit_paymentData');
  //   return step === 3 && paymentData;
  // });

  // const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    setShowNetworkModal(false);

    // Open QR Modal
    setTimeout(() => {
      setShowQRModal(true);
    }, 300);
  };

  // const { initializeLetspay, initError } = useLetsPay({
  //   paymentData,
  //   amount,
  // });

  // let's pay script
  useEffect(() => {
    if (scriptsLoadedRef.current) return;
    const jqueryScript = document.createElement('script');
    jqueryScript.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
    jqueryScript.async = true;
    jqueryScript.onload = () => {
      const letspayScript = document.createElement('script');
      letspayScript.src = 'https://user.letspay.money/assets/scripts/letspay.js';
      letspayScript.type = 'text/javascript';
      letspayScript.async = true;
      letspayScript.onload = () => {
        scriptsLoadedRef.current = true;
        setTimeout(() => {
          if (window.letspay && paymentData) {
            initializeLetspay();
          }
        }, 100);
      };
      letspayScript.onerror = () => {
        setInitError('Failed to load payment script. Please refresh the page.');
      };
      document.body.appendChild(letspayScript);
    };
    jqueryScript.onerror = () => {
      setInitError('Failed to load required scripts. Please refresh the page.');
    };
    document.body.appendChild(jqueryScript);

    return () => {
      const jquery = document.querySelector('script[src*="jquery.min.js"]');
      const letspay = document.querySelector('script[src*="letspay.js"]');
      if (jquery && jquery.parentNode) jquery.parentNode.removeChild(jquery);
      if (letspay && letspay.parentNode) letspay.parentNode.removeChild(letspay);
    };
  }, []);

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(value);
    setShowLetsPay(false);
    if (value.trim() !== "") {
      setErrorMessage(prev => ({ ...prev, amount: "" }));
    }
  };

  const fetchDepositeHistory = async () => {
    setIsHistoryLoading(true);

    try {
      const response = await api.get('/wallet/deposits');

      if (response?.status === true) {
        setDepositHistory(response.deposits || []);
        setPagination(response.pagination);
      } else {
        showError(response?.message || 'Failed to fetch deposit history');
      }

    } catch (error) {
      console.error(error.response?.data?.message || error.message || 'API error');
    } finally {
      setIsHistoryLoading(false);
    }
  }

  useEffect(() => {
    fetchDepositeHistory();
  }, []);

  const handleProceed = () => {
    const MAX_AMOUNT = 1000000; // 10 lakh

    let newErrors = { amount: "" };

    if (!amount || amount.trim() === "") {
      newErrors.amount = "Amount is required.";
    } else if (parseFloat(amount) < 1) {
      newErrors.amount = "Enter minimum amount of $1";
    } else if (parseFloat(amount) > MAX_AMOUNT) {
      newErrors.amount = "Maximum deposit amount is $1,000,000.";
    }

    if (newErrors.amount) {
      setErrorMessage(newErrors);
      return;
    }

    setErrorMessage({ amount: "" });

    setIsDepositModalOpen(true);

    // setShowCoinModal(true);
    // setShowNetworkModal(true);
  };

  const handleCoinSelect = (coin) => {
    setShowCoinModal(false);
    setTimeout(() => {
      setShowNetworkModal(true); // Open Network Selection next
    }, 300);
  };

  const handleProceed1 = async () => {
    let newErrors = {
      amount: "",
      network: ""
    };

    if (!selectedNetwork) {
      newErrors.network = "Please select network type.";
    }

    if (!amount || amount.trim() === "") {
      newErrors.amount = "Amount is required.";
    } else if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = "Please enter a valid amount";
      return;
    }

    const amountValue = parseFloat(amount);
    if (amountValue < 1) {
      newErrors.amount = "Minimum amount is $1";
    }

    if (newErrors.amount || newErrors.network) {
      setErrorMessage(newErrors);
      return;
    }

    setErrorMessage({ amount: "", network: "" });
    setIsLoading(true);
    const deviceInfo = await getDeviceInfo();

    const bodyData = {
      name: user.full_name,
      network: selectedNetwork,
      coinname: "USDT",
      amount: amount,
      email: user.email,
      device_info: deviceInfo,
    };

    try {
      const response = await api.post('/wallet/before_deposit', bodyData);

      // console.log("------response ", response);

      if (response.invoiceid || response.merchantid || response.currency) {
        // setPaymentData({
        //   invoiceid: response.invoiceid,
        //   merchantid: response.merchantid,
        //   currency: response.currency || 'USD',
        // });

        const newPaymentData = {
          invoiceid: response.invoiceid,
          merchantid: response.merchantid,
          currency: response.currency || 'USD',
          amount: amountValue
        };

        localStorage.setItem('payment_data', JSON.stringify(newPaymentData));

        window.location.href = response.payment_url;
        // setPaymentData(newPaymentData);
        // setIsLaunchingScript(true);
        // launchLetspayUI(newPaymentData);
        // showSuccess('Payment initialized successfully');
      } else {
        throw new Error(response.message || 'Failed to initialize payment');
      }
    } catch (error) {
      console.error('Error initializing payment:', error);
      setErrorMessage(error?.message || 'Failed to initialize payment. Please try again.');
      showError(error?.message || 'Failed to initialize payment. Please try again.');
      setShowLetsPay(false);
    } finally {
      setIsLoading(false);
    }
  };

  const launchLetspayUI = (data) => {
    if (!window.letspay) {
      setInitError('Payment script not loaded. Please refresh.');
      return;
    }

    if (observerRef.current) observerRef.current.disconnect();
    const container = document.getElementById('letspaybutton');
    if (!container) return;

    observerRef.current = new MutationObserver((mutations) => {
      const btn = container.querySelector('input[type="image"], button');
      if (btn) {
        btn.click();
        observerRef.current.disconnect();
        setIsLaunchingScript(true);
        // setIsLaunchingScript(false);
      }
    });

    observerRef.current.observe(container, { childList: true, subtree: true });

    try {
      window.letspay.init({
        "name": "Deposit Funds",
        "amount": data.amount,
        "invoiceno": data.invoiceid,
        "currency": data.currency,
        "email": user?.email,
        "merchantid": data.merchantid,
      });

      setTimeout(() => {
        observer.disconnect();
        setIsLaunchingScript(false);
      }, 5000);

    } catch (error) {
      observer.disconnect();
      console.error("Letspay Modal Error:", error);
      setInitError("Failed to open payment window.");
    }
  };

  const handlePayment = async () => {
    if (!paymentData) {
      showError('Payment data not found. Please try again.');
      return;
    }

    setIsProcessingPayment(true);
    setErrorMessage('');

    try {
      const response = await api.post('/payment/process-deposit', {
        payment_id: paymentData.paymentId,
        amount: paymentData.amount,
      });

      if (response.success || response.status === 'success' || response.payment_status === 'completed') {
        setCurrentStep('success');
        showSuccess('Payment completed successfully!');
      } else {
        throw new Error(response.message || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setCurrentStep('failed');
      setErrorMessage(error?.message || 'Payment processing failed. Please try again.');
      showError(error?.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleBack = () => {
    setCurrentStep('amount');
    setPaymentData(null);
    setErrorMessage('');
  };


  // const renderCurrentScreen = () => {
  //   if (currentStep === "payment") {
  //     return (
  //       <PaymentScreen
  //         paymentData={paymentData}
  //         amount={amount}
  //         isProcessingPayment={isProcessingPayment}
  //         onBack={handleBack}
  //         onPayment={handlePayment}
  //       />
  //     );
  //   }
  //   return null;
  // };


  const filteredData = useMemo(() => {
    let data = depositHistory;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.status.toLowerCase().includes(query) ||
        (item.amount && item.amount.toString().includes(query)) ||
        (item.invoiceid && item.invoiceid.toLowerCase().includes(query)) ||
        (item.orderno && item.orderno.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortConfig.key) {
      data = [...data].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // if (sortConfig.key === 'date' || sortConfig.key === 'createdAt' || sortConfig.key === 'executedAt' || sortConfig.key === 'completedAt') {
        //   aVal = new Date(aVal).getTime();
        //   bVal = new Date(bVal).getTime();
        // }

        const dateKeys = ['date', 'createdAt', 'executedAt', 'completedAt', 'ondate', 'trandate'];

        if (dateKeys.includes(sortConfig.key) && aVal && bVal) {
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
  }, [searchQuery, sortConfig, depositHistory]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Excel Export
  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => {
      return {
        'Date/Time': formatDate(item.ondate),
        'Invoice ID': item.invoiceid,
        'Order No': item.orderno,
        'Amount': `${Number(item.amount || 0).toFixed(4)} ${item.asset ?? ''}`,
        'Status': item.status,
        'Transection Date': formatDate(item.trandate),
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deposit History');

    const fileName = `Deposit_History_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    // setShowExportDropdown(false);
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

  if (!isReady) return null;

  return (
    <div className="pay-deposit-page">
      {/* <Header /> */}
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
      {/* {renderCurrentScreen()} */}
      <div className='crypto-container '>
        {/* <div className="deposit-section">
          <label className="deposit-label">Select Deposit Crypto</label>
          <div className="methods-grid">
            <button className={`method-card ${selectedMethod === "crypto" ? "active" : ""
              }`}
              onClick={() =>
                setSelectedMethod((prev) => (prev === "crypto" ? null : "crypto"))
              }>
              <div className="method-icon">🏦</div>
              <div className="method-info">
                <h3 className="method-name">Bank Transfer</h3>
                <div className="method-details">
                  <div className="method-detail">
                    <span className="detail-label">Time:</span>
                    <span className="detail-value">1-3 business days</span>
                  </div>
                  <div className="method-detail">
                    <span className="detail-label">Fee:</span>
                    <span className="detail-value">0% or minimal</span>
                  </div>
                  <div className="method-detail">
                    <span className="detail-label">Limit:</span>
                    <span className="detail-value">$50-$50,000/day</span>
                  </div>
                </div>
              </div>
              <div className="method-check">
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            </button>

          </div>
        </div> */}
        {/* {selectedMethod === "crypto" && ( */}
        <div className="profileHeading">
          <h1 className="HelpHeader">Deposit Crypto</h1>
          <p className="HelpDescription">
            Transfer Derails & History Details
          </p>
        </div>
        <div className="deposit-section">
          <h3 className="form-title">Crypto Transfer Details</h3>
          {/* <div className="form-group">
            <label className="form-label">
              Select Network Type
            </label>
            <div className="flex gap-6 mb-4">
              <div className="w-full mb-2">
                <div
                  className={`network-card cursor-pointer ${selectedNetwork === "TRC20" ? "active-card" : ""}`}
                  onClick={() => {
                    setSelectedNetwork("TRC20");
                    setErrorMessage(prev => ({ ...prev, network: "" }));
                  }}
                  style={{ cursor: "pointer", minHeight: "80px" }}
                >
                  <div className="card-body d-flex flex-column justify-content-center align-items-center p-2 text-center">
                    <h6 className="mb-1 fw-bold">TRC20-USDT</h6>
                    <p className="mb-0 text-muted small" style={{ fontSize: '10px' }}>
                      Network: TRON
                    </p>
                  </div>
                </div>
              </div>
              <div className="w-full mb-2">
                <div
                  className={`network-card cursor-pointer ${selectedNetwork === "BEP20" ? "active-card" : ""}`}
                  onClick={() => {
                    setSelectedNetwork("BEP20");
                    setErrorMessage(prev => ({ ...prev, network: "" }));
                  }}
                  style={{ cursor: "pointer", minHeight: "80px" }}
                >
                  <div className="card-body d-flex flex-column justify-content-center align-items-center p-2 text-center">
                    <h6 className="mb-1 fw-bold">BEP20-USDT</h6>
                    <p className="mb-0 text-muted small" style={{ fontSize: '10px' }}>
                      Network: BSC
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {errorMessage.network && <p className="error">{errorMessage.network} </p>}
          </div> */}

          <div className="form-group">
            <label className="form-label">Deposit Amount</label>

            <div className="amount-input-group">
              <span className="currency-symbol">USD</span>

              <input
                className="form-input"
                placeholder="0.00"
                type="number"
                min={1}
                max={1000000}
                value={amount}
                onChange={handleAmountChange}
                disabled={showLetsPay}
              />
            </div>

            <p className="form-helper">
              Minimum: USD 1, Maximum: USD 1,000,000
            </p>

            {errorMessage.amount && (
              <p style={{ fontSize: "14px" }} className="error">{errorMessage.amount}</p>
            )}
          </div>

          <div className="deposite-btn-section">
            <div id="letspaybutton" style={{ display: 'none' }}></div>
            <button
              className="deposite-button"
              onClick={handleProceed}
              disabled={isLoading || isLaunchingScript}
            >
              {(isLoading || isLaunchingScript) ? 'Processing...' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Deposit
                </>
              )}
            </button>
            {initError && <p className="payment-error">{initError}</p>}
          </div>

          {/* <CryptoDeposit
            key={isDepositModalOpen}
            isOpen={isDepositModalOpen}
            onClose={() => setIsDepositModalOpen(false)}
            amount={amount}
          /> */}

          <CryptoDeposit
            isOpen={isDepositModalOpen}
            onClose={() => {
              setIsDepositModalOpen(false);
              localStorage.removeItem('crypto_deposit_step');
            }}
            amount={amount}
          />
        </div>
        {/* )} */}

        {!isDepositModalOpen && (

          <div className="deposit-section transaction-history compact">
            <button className="section-toggle" onClick={() => setShowTransactionHistory(!showTransactionHistory)}>
              <h3 className="section-title">Deposit History</h3>
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className={showTransactionHistory ? 'rotated' : ''}

              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>


            {showTransactionHistory && (
              <>
                <div className='table_header'>
                  <div className="filter-search">

                    <svg xmlns="http://www.w3.org/2000/svg" className="search-icon" width="29" height="29" viewBox="0 0 29 29" fill="none">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by Invoice ID, Status, Amount"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="search-input"
                    />

                    {searchQuery && (
                      <button
                        className="clear-search"
                        onClick={() => {
                          setSearchQuery('')
                          setCurrentPage(1);
                        }}
                        aria-label="Clear search"
                      >
                        {/* <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg> */}
                      </button>
                    )
                    }


                  </div>

                  <div className="filter-dropdown-wrapper" >
                    <button
                      className="export-button"
                      onClick={() => setShowExportDropdown((prev) => !prev)}
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
                    {showExportDropdown && (
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
                </div>
                <div className="transaction-table">
                  <table className='transaction_table'>
                    <div className="transaction-header">
                      <div className="col-id"> Invoice ID </div>
                      <div className="col-date">Date/Time</div>
                      <div className="col-asset">Asset</div>
                      <div className="col-amount">Amount</div>
                      <div className="col-status">Status</div>
                      <div className="col-order">Order No</div>
                      <div className="col-trandate">Tran Date</div>
                    </div>
                    <div className="transaction-body">
                      {isHistoryLoading ? (
                        <div className="transaction-empty">
                          <p>Fetching deposit history...</p>
                        </div>
                      ) :
                        paginatedData.length > 0 ? (
                          paginatedData.map((tx) => (
                            <div key={tx.id} className="transaction-row">
                              <div className="col-id">
                                <div className="date-display">
                                  <span className="date-value">{tx?.invoiceid || "-"}</span>
                                </div>
                              </div>
                              <div className="col-date">
                                <div className="date-display">
                                  <span className="date-value">{tx?.ondate || "-"}</span>
                                  {/* <span className="time-value">{tx?.time || "-"}</span> */}
                                </div>
                              </div>
                              <div className="col-asset">
                                <span className="amount-value">{tx?.asset || "-"}</span>
                              </div>
                              <div className="col-amount">
                                <span className="amount-value">{tx?.amount || "-"}</span>
                              </div>

                              <div className="col-status">
                                <span className={`status-badge status-${tx?.status.toLowerCase()}`}>
                                  <span className="status-dot"></span>
                                  {tx?.status}
                                </span>
                              </div>
                              <div className="col-order">
                                <span className="amount-value">{tx?.orderno || "-"}</span>
                                {tx?.orderno && (
                                  <button
                                    type="button"
                                    className="wallet-copy-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyOrderNo(tx.orderno);
                                    }}
                                    title="Copy Order No"
                                  >
                                    <Copy size={14} />
                                  </button>
                                )}
                              </div>
                              <div className="col-trandate">
                                <button className="txid-link">
                                  {tx?.trandate || "-"}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="transaction-empty">
                            <p>No recent deposits</p>
                          </div>
                        )
                      }
                      {/* {paginatedData.length > 0 ? (
                    paginatedData.map((tx) => (
                      <div key={tx.id} className="transaction-row">
                        <div className="col-id">
                          <div className="date-display">
                            <span className="date-value">{tx?.invoiceid || "-"}</span>
                          </div>
                        </div>
                        <div className="col-date">
                          <div className="date-display">
                            <span className="date-value">{tx?.ondate || "-"}</span>
                          </div>
                        </div>
                        <div className="col-asset">
                          <span className="amount-value">{tx?.asset || "-"}</span>
                        </div>
                        <div className="col-amount">
                          <span className="amount-value">{tx?.amount || "-"}</span>
                        </div>

                        <div className="col-status">
                          <span className={`status-badge status-${tx?.status.toLowerCase()}`}>
                            <span className="status-dot"></span>
                            {tx?.status}
                          </span>
                        </div>
                        <div className="col-order">
                          <span className="amount-value">{tx?.orderno || "-"}</span>
                        </div>
                        <div className="col-trandate">
                          <button className="txid-link">
                            {tx?.trandate || "-"}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="transaction-empty">
                      <p>No recent deposits</p>
                    </div>
                  )} */}
                    </div>
                  </table>
                </div>
                {/* Pagination */}
                {paginatedData.length > 0 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} deposits
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
              </>
            )}
          </div>
        )}
      </div>


    </div>
  );
};

export default PayThroughDeposit;
