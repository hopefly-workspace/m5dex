/**
 * Deposit Fiat Currency Page
 * Screen for depositing fiat currency with multiple payment methods
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { copyToClipboard } from '../utils/clipboard';
import { useLatestNotification } from '../contexts/LatestNotificationContext';
import '../styles/pages/DepositFiat.css';
import { getDeviceInfo } from '../utils/clientDeviceInfo';
import { useUser } from "../contexts/UserContext";

// Fiat currencies
const fiatCurrencies = [
  { code: 'USD', name: 'United States Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
];

// Deposit methods
const depositMethods = [
  {
    id: 'bank',
    name: 'Bank Transfer',
    icon: '🏦',
    processingTime: '1-3 business days',
    fee: '0% or minimal',
    minLimit: 50,
    maxLimit: 50000,
    description: 'Direct bank transfer',
  },
  {
    id: 'card',
    name: 'Debit Card',
    icon: '💳',
    processingTime: 'Instant',
    fee: '2.5% - 3.5%',
    minLimit: 20,
    maxLimit: 10000,
    description: 'Visa, Mastercard, Amex',
  },
  {
    id: 'wire',
    name: 'Wire Transfer',
    icon: '🌐',
    processingTime: '2-5 business days',
    fee: 'Varies by bank',
    minLimit: 500,
    maxLimit: 100000,
    description: 'International wire transfer',
  },
  {
    id: 'thirdparty',
    name: 'Third-Party Payment',
    icon: '💼',
    processingTime: 'Instant - 24 hours',
    fee: '1% - 2%',
    minLimit: 10,
    maxLimit: 5000,
    description: 'PayPal, Wise, etc.',
  },
];

const depositeReciptURL = import.meta.env.VITE_IMAGE_URL || ""

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

const DepositFiat = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { showSuccess, showError } = useToast();
  const { refresh: refreshNotifications } = useLatestNotification() || {};
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [fiatDepositeHistory, setFiatDepositHistory] = useState([]);
  const [bankDetail, setBankDetail] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'ondate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [formData, setFormData] = useState({
    paymenttype: 'UPI',
    amount: '',
    tranid: '',
    trandate: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [bankAccounts] = useState([
    { id: '1', name: 'Chase Bank - ****1234', account: '1234' },
    { id: '2', name: 'Bank of America - ****5678', account: '5678' },
  ]);

  const closeShowImage = () => setSelectedImg(null);

  // Generate reference code
  const referenceCode = `REF${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

  // Filter currencies
  const filteredCurrencies = fiatCurrencies.filter(currency =>
    currency.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    currency.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredData = useMemo(() => {
    let data = fiatDepositeHistory;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.status.toLowerCase().includes(query) ||
        (item.usdtamount && item.usdtamount.toString().includes(query)) ||
        (item.inramount && item.inramount.toString().includes(query)) ||
        (item.depositid && item.depositid.toLowerCase().includes(query)) ||
        (item.paymenttype && item.paymenttype.toLowerCase().includes(query))
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
  }, [searchQuery, sortConfig, fiatDepositeHistory]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const getBankDetails = async () => {
    setLoading(true);

    try {
      const response = await api.get('/wallet/bank');

      if (response?.status === true) {
        setBankDetail(response.data);
        // setPagination(response.pagination);
      } else {
        showError(response?.message || 'Failed to fetch bank details');
      }

    } catch (error) {
      console.error(error.response?.data?.message || error.message || 'API error');
    } finally {
      setLoading(false);
    }
  }

  const fetchDepositeHistory = async () => {
    setIsHistoryLoading(true);

    try {
      const response = await api.get('/wallet/fiatdeposits');

      if (response?.status === true) {
        setFiatDepositHistory(response.deposits || []);
        // setPagination(response.pagination);
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
    getBankDetails();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.currency-dropdown')) {
        setShowCurrencyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle currency selection
  const handleCurrencySelect = (currency) => {
    setSelectedCurrency(currency.code);
    setShowCurrencyDropdown(false);
    setSearchQuery('');
  };

  // Handle method selection
  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    setFormData({
      amount: '',
      bankAccount: '',
      cardNumber: '',
      cardholderName: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      saveCard: false,
    });
  };

  // Calculate fee for card payment
  const calculateFee = () => {
    if (!formData.amount || selectedMethod !== 'card') return 0;
    const amount = parseFloat(formData.amount);
    return amount * 0.025; // 2.5% fee
  };

  const selectedCurrencyData = fiatCurrencies.find(c => c.code === selectedCurrency);
  const selectedMethodData = depositMethods.find(m => m.id === selectedMethod);
  const totalAmount = parseFloat(formData.amount || 0) + calculateFee();

  // Format card number
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  // Handle card number input
  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData({ ...formData, cardNumber: formatted });
  };

  const handleFileChange = (e) => {
    //   setReceiptFile(e.target.files[0]);
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    // File type validation
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid file type. Please upload a PNG or JPG image.');
      e.target.value = '';
      setReceiptFile(null);
      return;
    }

    // File size validation
    if (file.size > maxSize) {
      showError('File size must be 2MB or less.');
      e.target.value = '';
      setReceiptFile(null);
      return;
    }

    setReceiptFile(file);
  };

  const resetDepositForm = () => {
    setFormData({
      paymenttype: '',
      amount: '',
      tranid: '',
      trandate: '',
    });
    setFormErrors({});
    setReceiptFile(null);
    const fileInput = document.getElementById('receipt');
    if (fileInput) fileInput.value = '';
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = String(formData.amount || '').trim();
    const tranid = String(formData.tranid || '').trim();
    const trandate = String(formData.trandate || '').trim();
    const paymenttype = String(formData.paymenttype || 'UPI').trim();

    const errors = {};
    if (!amount) errors.amount = 'Amount is required.';
    else if (Number(amount) <= 0) errors.amount = 'Amount must be greater than 0.';

    if (!tranid) errors.tranid = 'Transaction ID is required.';

    if (!trandate) {
      errors.trandate = 'Transaction Date is required.';
    } else {
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (trandate > todayStr) {
        errors.trandate = 'Transaction date cannot be in the future.';
      }
    }

    if (!receiptFile) errors.receipt = 'Please upload the payment receipt.';
    else if (receiptFile.size > 2 * 1024 * 1024) errors.receipt = 'Receipt file size must be 2MB or less.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const deviceInfo = await getDeviceInfo();
      const payload = new FormData();
      payload.append('paymenttype', paymenttype);
      payload.append('amount', amount);
      payload.append('tranid', tranid);
      payload.append('trandate', trandate);
      payload.append('receipt', receiptFile);
      payload.append('device_info', JSON.stringify(deviceInfo));

      const response = await api.post('/wallet/fiatdeposit', payload);

      const ok =
        response?.code === 200 ||
        response?.status === true ||
        response?.status === 'Success';

      if (ok) {
        showSuccess(response?.msg || 'Deposit requested successfully!');
        resetDepositForm();
        fetchDepositeHistory();
        refreshNotifications?.();
      } else {
        showError(response?.msg || response?.message || 'Deposit request failed.');
      }
    } catch (error) {
      const msg =
        error?.data?.msg ||
        error?.data?.message ||
        error?.message ||
        'Failed to submit deposit request. Please try again.';
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => {

      const receiptName = item.receipt ? item.receipt.split('/').pop() : '';

      return {
        'Deposit ID': item.depositid,
        'Date/Time': formatDate(item.ondate),
        'Amount(INR)': `${item.inramount.toFixed(4)}`,
        'USDT Value': `${item.usdtvalue.toFixed(4)}`,
        'Amount(USDT)': `${item.usdtamount.toFixed(4)}`,
        'Method': item.paymenttype,
        'Status': item.status,
        'Receipt': receiptName,
        'Transaction ID': item.tranid,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fait Deposit History');

    const fileName = `Fait_Deposit_History_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    // setShowExportDropdown(false);
  };

  return (
    <div className="deposit-fiat-page">
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
          <h1 className="deposit-title">M5dex</h1>
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
        <div className="profileHeading">
          <h1 className="HelpHeader">Deposit Fiat Currency</h1>
          <p className="HelpDescription">
            Select Fiat Currency
          </p>
        </div>

        <div className="HelpMainContent">
          <div className="DepositCardBg">
            <div className="DepositHeadMain">
              <h2 className="DepositHeading">Deposit Funds</h2>
            </div>
            <form className="DepositForm ark-form" onSubmit={handleDepositSubmit} noValidate>
              <div className="DepositFiatForm">
                <div className="ark-form-group">
                  <label className="help-form-label" htmlFor="identifier">
                    Payment Deposit
                  </label>
                  <div className="ark-input-wrapper">
                    <select
                      id="paymenttype"
                      className="ark-input HelpInput"
                      value={formData.paymenttype || 'UPI'}
                      onChange={(e) => setFormData({ ...formData, paymenttype: e.target.value })}
                      required
                    >
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Debit Card</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="DepositFiatForm">
                <div className="ark-form-group">
                  <div className="AmountMini">
                    <label className="help-form-label" htmlFor="identifier">
                      Amount
                    </label>
                    {/* <label className="help-form-label" htmlFor="identifier">
                      Minimum Deposit: $50
                    </label> */}
                  </div>
                  <div className="ark-input-wrapper">
                    <input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      className="ark-input HelpInput"
                      value={formData.amount}
                      min="0"
                      // onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setFormData({ ...formData, amount: val });
                          if (formErrors.amount) setFormErrors({ ...formErrors, amount: null });
                        }
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', fontWeight: '600' }}>
                    <span className="amount-label">
                      1 USDT = {user?.usdtvalue} INR
                    </span>
                    {formData.amount && Number(formData.amount) > 0 ? (
                      <span>
                        <span className="amount-label">You will get </span>
                        <span className="amount-highlight">{Number(formData.amount / (user?.usdtvalue)).toFixed(6)} USDT</span>
                      </span>
                    ) : (
                      <span style={{ color: 'transparent' }}>You will get 0.000000 USDT</span>
                    )}
                  </div>
                  {formErrors.amount && <div className="input-error-text" style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>{formErrors.amount}</div>}
                </div>
              </div>
              <div className="HelpForm">
                <div className="ark-form-group help-form-group">
                  <label className="help-form-label" htmlFor="identifier">
                    Transaction ID
                  </label>
                  <div className="ark-input-wrapper">
                    <input
                      id='tranid'
                      type="text"
                      value={formData.tranid}
                      placeholder="Enter transaction Id"
                      className="ark-input HelpInput"
                      onChange={(e) => {
                        setFormData({ ...formData, tranid: e.target.value });
                        if (formErrors.tranid) setFormErrors({ ...formErrors, tranid: null });
                      }}
                    />
                  </div>
                  {formErrors.tranid && <div className="input-error-text" style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>{formErrors.tranid}</div>}
                </div>
                <div className="ark-form-group help-form-group">
                  <label className="help-form-label" htmlFor="identifier">
                    Transaction Date
                  </label>
                  <div className="ark-input-wrapper">
                    <input
                      id="trandate"
                      type="date"
                      placeholder="Last Name"
                      className="ark-input HelpInput"
                      value={formData.trandate || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, trandate: e.target.value });
                        if (formErrors.trandate) setFormErrors({ ...formErrors, trandate: null });
                      }}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  {formErrors.trandate && <div className="input-error-text" style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>{formErrors.trandate}</div>}
                </div>
              </div>
              <div className="DepositFiatForm help-form-group">
                <div className="ark-form-group">
                  <label className="help-form-label" htmlFor="identifier">
                    Upload Receipt
                  </label>
                  <div className="ark-input-wrapper">
                    <input
                      id="receipt"
                      type="file"
                      placeholder="Selct receipt"
                      className="ark-input HelpInput"
                      onChange={(e) => {
                        handleFileChange(e);
                        if (formErrors.receipt) setFormErrors({ ...formErrors, receipt: null });
                      }}
                      accept="image/*"
                    // accept=".jpg, .jpeg, .png"
                    />
                  </div>
                  {formErrors.receipt && <div className="input-error-text" style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>{formErrors.receipt}</div>}
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="ark-btn ark-btn-primary"
                  style={{ width: "100%" }}
                  disabled={isSubmitting}

                >
                  {isSubmitting ? "Processing..." : "Submit Deposit"}
                  {/* Submit */}
                </button>
              </div>
            </form>
          </div>

          <div className="ArkSupport">
            <div className="DepositCardBg">
              <div className="DepositHeadMain">
                <h2 className="DepositHeading">Account Details</h2>
              </div>
              <div className="HelpForm DepositMainSpace">
                <div className="DepositDetails">
                  <p className="AccountText">Account HolderName : <span className="AccountSpan">{bankDetail?.accholdername}</span></p>
                  {/* <p className="AccountText">Mobile No : <span className="AccountSpan">{bankDetail?.accholdername}</span></p> */}
                  <p className="AccountText">Bank Name : <span className="AccountSpan">{bankDetail?.bankname}</span></p>
                  <p className="AccountText">Account Type : <span className="AccountSpan">{bankDetail?.accholdername}</span></p>
                  <p className="AccountText">Account No : <span className="AccountSpan">{bankDetail?.accountno}</span></p>
                  <p className="AccountText">UPI ID : <span className="AccountSpan">{bankDetail?.upiid}</span></p>
                </div>
                <div className="DepositQR">
                  <div className="DepositQRBG" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {bankDetail?.qrcode ? (
                      <img
                        src={bankDetail.qrcode}
                        alt="QR Code"
                        style={{ width: '178px', height: '178px', objectFit: 'contain' }}
                      />
                    ) : (
                      "No QR Available"
                    )}
                  </div>
                  {/* <div className="DepositQRBG">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      width={178}
                      height={178}
                      viewBox="0 0 178 178"
                      fill="none"
                    >
                      <rect width={178} height={178} fill="url(#pattern0_749_262)" />
                      <defs>
                        <pattern
                          id="pattern0_749_262"
                          patternContentUnits="objectBoundingBox"
                          width={1}
                          height={1}
                        >
                          <use
                            xlinkHref="#image0_749_262"
                            transform="translate(-0.208324 -0.0815092) scale(0.00070754)"
                          />
                        </pattern>
                        <image
                          id="image0_749_262"
                          width={2000}
                          height={2000}
                          preserveAspectRatio="none"
                        />
                      </defs>
                    </svg>

                  </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="DepositFiatRecent">
          <div className="DepositHeadMain">
            <h2 className="DepositHeading">Recent Fiat Deposit</h2>
          </div>
          <div className="DepositCardBg ReCentTable">
            <div className='table_header'>
              <div className="filter-search">

                <svg xmlns="http://www.w3.org/2000/svg" className="search-icon" width="29" height="29" viewBox="0 0 29 29" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by Deposit ID, Status, Method"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="search-input currency_input"
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
                  <div className="col-date">Deposit ID</div>
                  <div className="col-date">Date/Time</div>
                  <div className="col-amount">Amount(INR)</div>
                  <div className="col-amount">USDT value</div>
                  <div className="col-amount">Amount(USDT)</div>
                  <div className="col-method">Method</div>
                  <div className="col-status">Status</div>
                  <div className="col-attachment">Attachment</div>
                  <div className="col-txid">Transaction ID</div>
                </div>
                <div className="transaction-body">
                  {
                    isHistoryLoading ? (
                      <div className="transaction-empty">
                        <p>Fetching fiat deposit history...</p>
                      </div>
                    ) :
                      paginatedData.length > 0 ? (
                        paginatedData.map((tx) => (
                          <div key={tx.id} className="transaction-row">
                            <div className="col-date">
                              <div className="date-display">
                                <span className="date-value">{tx?.depositid}</span>
                              </div>
                            </div>
                            <div className="col-date">
                              <div className="date-display">
                                <span className="date-value">{tx?.ondate}</span>
                              </div>
                            </div>
                            <div className="col-amount">
                              <span className="amount-value">{tx?.inramount}</span>
                            </div>
                            <div className="col-amount">
                              <span className="amount-value">{tx?.usdtvalue}</span>
                            </div>
                            <div className="col-amount">
                              <span className="amount-value">{tx?.usdtamount}</span>
                            </div>
                            <div className="col-method">{tx?.paymenttype}</div>
                            <div className="col-status">
                              <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                                <span className="status-dot"></span>
                                {tx?.status}
                              </span>
                            </div>
                            {/* <div className="col-txid">
                              <button className="txid-link">
                                {tx?.receipt}
                              </button>
                            </div> */}
                            <div className="col-attachment">
                              {tx?.receipt ? (
                                <img
                                  src={depositeReciptURL + tx.receipt}
                                  alt="receipt"
                                  className="thumbnail-img"
                                  onClick={() => setSelectedImg(depositeReciptURL + tx.receipt)}
                                />
                              ) : (
                                "No Image"
                              )}
                            </div>
                            <div className="col-txid">
                              <div className="txid-link">
                                {tx?.tranid}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="transaction-empty">
                          <p>No recent deposits</p>
                        </div>
                      )
                  }

                  {/* {fiatDepositeHistory.length > 0 ? (
                  fiatDepositeHistory.map((tx) => (
                    <div key={tx.id} className="transaction-row">
                      <div className="col-date">
                        <div className="date-display">
                          <span className="date-value">{tx?.ondate}</span>
                        </div>
                      </div>
                      <div className="col-amount">
                        <span className="amount-value">{tx?.usdtamount}</span>
                      </div>
                      <div className="col-amount">
                        <span className="amount-value">{tx?.inramount}</span>
                      </div>
                      <div className="col-method">{tx?.paymenttype}</div>
                      <div className="col-status">
                        <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                          <span className="status-dot"></span>
                          {tx?.status}
                        </span>
                      </div>
                      <div className="col-txid">
                        <button className="txid-link">
                          {tx?.tranid}
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
              {/* {selectedImg && (
                <div className="image-modal-overlay" onClick={closeShowImage}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="modal-close-btn close-btn"
                      onClick={closeShowImage}
                    >
                      ✕
                    </button>

                    <img
                      src={selectedImg}
                      alt="Deposit Receipt"
                      className="big-image"
                    />
                  </div>
                </div>
              )} */}
              {selectedImg && (
                <div
                  className="image-modal-overlay"
                  onClick={closeShowImage}
                >
                  <div
                    className="image-modal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="modal-header">
                      <h3 className="modal-title">
                        Deposit Receipt
                      </h3>

                      <button
                        className="modal-close-btn " style={{ cursor: "pointer" }}
                        onClick={closeShowImage}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Body */}
                    <div className="modal-body" style={{ padding: "15px" }}>
                      <img
                        src={selectedImg}
                        alt="Deposit Receipt"
                        className="big-image"
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* {selectedImg && (
                <div className="image-modal-overlay" onClick={closeShowImage}>
                  <div className="modal-content">
                    <span className="close-btn" onClick={closeShowImage}>&times;</span>
                    <img src={selectedImg} alt="Enlarged receipt" className="big-image" />
                  </div>
                </div>
              )} */}
            </div>
            {paginatedData.length > 0 && (
              <div className="pagination-container mt-3">
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
                <select
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
                </select>
              </div>
            )}
          </div>

        </div>


        {/* Currency Selection */}
        {/* <div className="selection-row">
          <div className="selection-group">
            <label className="deposit-label">Select Fiat Currency</label>
            <div className="currency-dropdown">
              <button
                className="dropdown-trigger compact"
                onClick={() => {
                  setShowCurrencyDropdown(!showCurrencyDropdown);
                }}
              >
                <div className="dropdown-selected">
                  <span className="currency-flag">{selectedCurrencyData?.flag}</span>
                  <span className="currency-code">{selectedCurrency}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showCurrencyDropdown && (
                <div className="dropdown-menu">
                  <div className="dropdown-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search currency..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <div className="dropdown-list">
                    {filteredCurrencies.map((currency) => (
                      <button
                        key={currency.code}
                        className={`dropdown-item ${selectedCurrency === currency.code ? 'active' : ''}`}
                        onClick={() => handleCurrencySelect(currency)}
                      >
                        <span className="currency-flag">{currency.flag}</span>
                        <div className="currency-info">
                          <span className="currency-code">{currency.code}</span>
                          <span className="currency-name">{currency.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div> */}

        {/* Deposit Method Selection */}
        {/* <div className="deposit-section">
          <label className="deposit-label">Select Deposit Method</label>
          <div className="methods-grid">
            {depositMethods.map((method) => (
              <button
                key={method.id}
                className={`method-card ${selectedMethod === method.id ? 'active' : ''}`}
                onClick={() => handleMethodSelect(method.id)}
              >
                <div className="method-icon">{method.icon}</div>
                <div className="method-info">
                  <h3 className="method-name">{method.name}</h3>
                  <div className="method-details">
                    <div className="method-detail">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">{method.processingTime}</span>
                    </div>
                    <div className="method-detail">
                      <span className="detail-label">Fee:</span>
                      <span className="detail-value">{method.fee}</span>
                    </div>
                    <div className="method-detail">
                      <span className="detail-label">Limit:</span>
                      <span className="detail-value">
                        ${method.minLimit.toLocaleString()}-${method.maxLimit.toLocaleString()}/day
                      </span>
                    </div>
                  </div>
                </div>
                {selectedMethod === method.id && (
                  <div className="method-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div> */}

        {/* Bank Transfer Form */}
        {/* {selectedMethod === 'bank' && selectedMethodData && (
          <div className="deposit-section">
            <h3 className="form-title">Bank Transfer Details</h3>

            <div className="form-group">
              <label className="form-label">Deposit Amount</label>
              <div className="amount-input-group">
                <span className="currency-symbol">{selectedCurrency}</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  min={selectedMethodData.minLimit}
                  max={selectedMethodData.maxLimit}
                />
              </div>
              <p className="form-helper">
                Minimum: {selectedCurrency} {selectedMethodData.minLimit.toLocaleString()},
                Maximum: {selectedCurrency} {selectedMethodData.maxLimit.toLocaleString()}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Bank Account</label>
              <select
                className="form-input"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
                <option value="new">+ Add New Bank Account</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reference Code</label>
              <div className="reference-code-display">
                <span className="reference-code">{referenceCode}</span>
                <button
                  className="copy-button-small"
                  onClick={async () => {
                    try {
                      await copyToClipboard(referenceCode);
                      showSuccess('Reference code copied!');
                    } catch {
                      showError('Copy failed. Please select and copy manually.');
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </div>
              <div className="reference-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Include this reference code in your bank transfer</span>
              </div>
            </div>

            <div className="bank-details-section">
              <h4 className="bank-details-title">Bank Details for Transfer</h4>
              <div className="bank-details-grid">
                <div className="bank-detail-item">
                  <span className="bank-detail-label">Bank Name:</span>
                  <span className="bank-detail-value">Exchange Bank International</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">Account Holder:</span>
                  <span className="bank-detail-value">M5dex Ltd.</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">Account Number:</span>
                  <span className="bank-detail-value">XXXX-XXXX-XXXX-1234</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">IBAN:</span>
                  <span className="bank-detail-value">GB29 NWBK 6016 1331 9268 19</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">SWIFT/BIC:</span>
                  <span className="bank-detail-value">ABCDGB2L</span>
                </div>
                <div className="bank-detail-item highlight">
                  <span className="bank-detail-label">Reference Code:</span>
                  <span className="bank-detail-value">{referenceCode} (REQUIRED)</span>
                </div>
              </div>
              <div className="bank-details-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p><strong>Important:</strong></p>
                  <ul>
                    <li>Always include the reference code</li>
                    <li>Transfers without reference will be delayed</li>
                    <li>Processing time: 1-3 business days</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Debit Card Form */}
        {selectedMethod === 'card' && selectedMethodData && (
          <div className="deposit-section">
            <h3 className="form-title">Card Payment Details</h3>

            <div className="form-group">
              <label className="form-label">Card Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="1234 5678 9012 3456"
                value={formData.cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cardholder Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Name as on card"
                value={formData.cardholderName}
                onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <div className="expiry-input-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="MM"
                    value={formData.expiryMonth}
                    onChange={(e) => setFormData({ ...formData, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    maxLength={2}
                  />
                  <span className="expiry-separator">/</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="YY"
                    value={formData.expiryYear}
                    onChange={(e) => setFormData({ ...formData, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  CVV
                  <span className="info-icon" title="3 digits on back (4 for Amex)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  </span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="123"
                  value={formData.cvv}
                  onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deposit Amount</label>
              <div className="amount-input-group">
                <span className="currency-symbol">{selectedCurrency}</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  min={selectedMethodData.minLimit}
                  max={selectedMethodData.maxLimit}
                />
              </div>
              {formData.amount && (
                <div className="fee-calculation">
                  <div className="fee-row">
                    <span>Amount:</span>
                    <span>{selectedCurrency} {parseFloat(formData.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="fee-row">
                    <span>Fee ({selectedMethodData.fee.split(' - ')[0]}):</span>
                    <span>{selectedCurrency} {calculateFee().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="fee-row total">
                    <span>Total:</span>
                    <span>{selectedCurrency} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.saveCard}
                  onChange={(e) => setFormData({ ...formData, saveCard: e.target.checked })}
                />
                <span>Save this card for future use</span>
              </label>
            </div>

            <div className="form-actions">
              <button className="btn-primary" onClick={() => alert('Payment processing...')}>
                Pay Now
              </button>
              <button className="btn-secondary" onClick={() => setSelectedMethod(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Wire Transfer Form */}
        {selectedMethod === 'wire' && selectedMethodData && (
          <div className="deposit-section">
            <h3 className="form-title">Wire Transfer Details</h3>

            <div className="form-group">
              <label className="form-label">Deposit Amount</label>
              <div className="amount-input-group">
                <span className="currency-symbol">{selectedCurrency}</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  min={selectedMethodData.minLimit}
                  max={selectedMethodData.maxLimit}
                />
              </div>
              <p className="form-helper">
                Minimum: {selectedCurrency} {selectedMethodData.minLimit.toLocaleString()},
                Maximum: {selectedCurrency} {selectedMethodData.maxLimit.toLocaleString()}
              </p>
            </div>

            <div className="bank-details-section">
              <h4 className="bank-details-title">Wire Transfer Details</h4>
              <div className="bank-details-grid">
                <div className="bank-detail-item">
                  <span className="bank-detail-label">Bank Name:</span>
                  <span className="bank-detail-value">Exchange Bank International</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">SWIFT/BIC:</span>
                  <span className="bank-detail-value">ABCDGB2L</span>
                </div>
                <div className="bank-detail-item">
                  <span className="bank-detail-label">IBAN:</span>
                  <span className="bank-detail-value">GB29 NWBK 6016 1331 9268 19</span>
                </div>
                <div className="bank-detail-item highlight">
                  <span className="bank-detail-label">Reference Code:</span>
                  <span className="bank-detail-value">{referenceCode} (REQUIRED)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Third-Party Payment Form */}
        {selectedMethod === 'thirdparty' && selectedMethodData && (
          <div className="deposit-section">
            <h3 className="form-title">Third-Party Payment</h3>

            <div className="form-group">
              <label className="form-label">Deposit Amount</label>
              <div className="amount-input-group">
                <span className="currency-symbol">{selectedCurrency}</span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  min={selectedMethodData.minLimit}
                  max={selectedMethodData.maxLimit}
                />
              </div>
              <p className="form-helper">
                Minimum: {selectedCurrency} {selectedMethodData.minLimit.toLocaleString()},
                Maximum: {selectedCurrency} {selectedMethodData.maxLimit.toLocaleString()}
              </p>
            </div>

            <div className="third-party-options">
              <p className="form-helper">Select payment provider:</p>
              <div className="payment-providers">
                <button className="provider-btn">PayPal</button>
                <button className="provider-btn">Wise</button>
                <button className="provider-btn">Stripe</button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        {/* <div className="deposit-section transaction-history compact">
          <button 
            className="section-toggle"
            onClick={() => setShowTransactionHistory(!showTransactionHistory)}
          >
            <h3 className="section-title">Recent Fiat Deposits</h3>
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
                <div className="col-date">Date/Time</div>
                <div className="col-amount">Amount</div>
                <div className="col-method">Method</div>
                <div className="col-status">Status</div>
                <div className="col-txid">Transaction ID</div>
              </div>
              <div className="transaction-body">
                {transactionHistory.length > 0 ? (
                  transactionHistory.map((tx) => (
                    <div key={tx.id} className="transaction-row">
                      <div className="col-date">
                        <div className="date-display">
                          <span className="date-value">{tx.date}</span>
                          <span className="time-value">{tx.time}</span>
                        </div>
                      </div>
                      <div className="col-amount">
                        <span className="amount-value">{tx.amount}</span>
                      </div>
                      <div className="col-method">{tx.method}</div>
                      <div className="col-status">
                        <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                          <span className="status-dot"></span>
                          {tx.status}
                        </span>
                      </div>
                      <div className="col-txid">
                        <button className="txid-link">
                          {tx.txId}
                        </button>
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
        </div> */}
      </div>
    </div>
  );
};

export default DepositFiat;

