import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight, X, Clock, Check, Copy } from 'lucide-react';
import api from "../../services/api";
import '../../styles/components/payment/CryptoDeposit.css';
import axios from 'axios';
import { getDeviceInfo } from '../../utils/clientDeviceInfo';
import logo from "../../../public/assets/img/icon.png"

const CryptoDeposit = ({ isOpen, onClose, amount }) => {

    const [step, setStep] = useState(() => {
        return Number(localStorage.getItem('crypto_deposit_step')) || 1;
    });

    const [selectedCoin, setSelectedCoin] = useState(() => {
        const saved = localStorage.getItem('crypto_deposit_coin');
        return saved ? JSON.parse(saved) : null;
    });

    const [selectedNetwork, setSelectedNetwork] = useState(() => {
        return localStorage.getItem('crypto_deposit_network') || null;
    });

    const [paymentData, setPaymentData] = useState(() => {
        const saved = localStorage.getItem('crypto_deposit_paymentData');
        return saved ? JSON.parse(saved) : null;
    });

    // const [step, setStep] = useState(1);
    // const [selectedCoin, setSelectedCoin] = useState(null);
    // const [selectedNetwork, setSelectedNetwork] = useState(null);
    // const [paymentData, setPaymentData] = useState(null);


    const [shake, setShake] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copyStatus, setCopyStatus] = useState("");
    const [timeLeft, setTimeLeft] = useState(null);
    const pollingRef = useRef(null);
    const hasCalledExpire = useRef(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [apiError, setApiError] = useState(null);

    const coins = [
        { id: 'usdt', name: 'USDT', symbol: 'T', color: '#26A17B', amount: amount },

        // future coins (just add later)
        // { id: 'btc', name: 'BTC', symbol: '₿', color: '#f7931a', amount: amount },
        // { id: 'eth', name: 'ETH', symbol: 'Ξ', color: '#627eea', amount: amount },
    ];

    const filteredCoins = coins.filter((coin) =>
        coin.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const FRONT_URL = "https://globaltrade.blockcryp.com";

    useEffect(() => {
        localStorage.setItem('crypto_deposit_step', step);
        localStorage.setItem('crypto_deposit_coin', JSON.stringify(selectedCoin));
        localStorage.setItem('crypto_deposit_network', selectedNetwork || "");
        localStorage.setItem('crypto_deposit_paymentData', JSON.stringify(paymentData));
    }, [step, selectedCoin, selectedNetwork, paymentData]);

    useEffect(() => {
        if (step === 3 && paymentData?.orderno && isOpen) {
            startStatusPolling(paymentData.orderno);
        }
    }, [step, paymentData, isOpen]);

    const clearPersistedData = () => {
        localStorage.removeItem('crypto_deposit_step');
        localStorage.removeItem('crypto_deposit_coin');
        localStorage.removeItem('crypto_deposit_network');
        localStorage.removeItem('crypto_deposit_paymentData');
    };


    useEffect(() => {
        const checkOnRefresh = async () => {
            if (step === 3 && paymentData?.orderno) {
                try {
                    const response = await api.post('/wallet/fetchdepositstatus', {
                        orderno: paymentData.orderno
                    });

                    const resData = response.data?.data || response.data;

                    if (resData && [4, 5, 6, 7].includes(resData.statusid)) {
                        console.log("Refresh detected final status:", resData.statusid);

                        await handleFinalStatus(resData, paymentData.orderno);
                    }
                } catch (err) {
                    console.error("Refresh status check failed:", err);
                }
            }
        };

        checkOnRefresh();
    }, []);

    useEffect(() => {
        if (!isOpen) {
            hasCalledExpire.current = false;
            hasHandledFinal.current = false;
            setStep(1);
            setSelectedCoin(null);
            setSelectedNetwork(null);
            setPaymentData(null);
            setTimeLeft(null);
            setApiError(null);
            stopPolling();
            clearPersistedData();
        }
    }, [isOpen]);

    useEffect(() => {
        return () => stopPolling();
    }, []);

    useEffect(() => {
        let timer;

        if (step === 3 && timeLeft !== null && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }

        else if (timeLeft === 0 && !hasCalledExpire.current) {
            hasCalledExpire.current = true;
            console.log("Timer expired! Notifying server...");
            handleExpireDeposit();
            stopPolling();
        }

        return () => clearInterval(timer);
    }, [step, timeLeft]);

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const hasHandledFinal = useRef(false);

    const handleFinalStatus = async (resData, orderNo) => {
        if (hasHandledFinal.current) return;
        hasHandledFinal.current = true;

        const isSuccess = resData.statusid === 4;

        stopPolling();

        const deviceInfo = await getDeviceInfo();

        const finalPayload = {
            orderno: orderNo,
            statusid: resData.statusid,
            coinname: selectedCoin?.name || 'USDT',
            networkname: selectedNetwork,
            tranhash: resData.tranhash || "",
            address: paymentData?.address || resData.address,
            amount: resData.amount || amount,
            device_info: deviceInfo,
        };

        try {
            const depositRes = await api.post('/wallet/deposit', finalPayload);

            clearPersistedData();

            // OLD CODE - Static URL redirects
            // const baseUrl = `${FRONT_URL}/payment`;
            // const targetUrl = isSuccess
            //     ? `${baseUrl}/success?orderno=${orderNo}`
            //     : `${baseUrl}/failed?orderno=${orderNo}`;
            // window.location.href = targetUrl;

            // New logic: dynamic redirect URLs from API response directly
            let targetUrl;
            if (resData.statusid === 4) {
                targetUrl = resData.confirmurl;
            } else if (resData.statusid === 6) {
                targetUrl = resData.expireurl;
            } else {
                targetUrl = resData.failurl;
            }

            window.location.href = targetUrl;

        } catch (err) {
            console.error("Final deposit API failed:", err);

            clearPersistedData();

            // OLD CODE - Static URL fallback
            // window.location.href = `${FRONT_URL}}/payment/failed?orderno=${orderNo}`;

            // New logic fallback from API response directly
            window.location.href = resData.failurl;
        }
    };

    const startStatusPolling = (orderNo) => {
        stopPolling();

        const checkStatus = async () => {
            try {
                const response = await api.post('/wallet/fetchdepositstatus', { orderno: orderNo });
                const resData = response.data?.data || response.data || response;

                if (resData) {

                    if (resData.expirydate) {
                        const dateString = resData.expirydate.endsWith('Z') ? resData.expirydate : `${resData.expirydate}Z`;
                        const expiryTime = new Date(dateString).getTime();
                        const currentTime = new Date().getTime();
                        const diffInSeconds = Math.floor((expiryTime - currentTime) / 1000);

                        if (diffInSeconds > 0) {
                            setTimeLeft(diffInSeconds);
                        } else {
                            setTimeLeft(0);
                            stopPolling();
                        }
                    }

                    if ([4, 5, 6, 7].includes(resData.statusid)) {
                        console.log("Final status:", resData.statusid);

                        await handleFinalStatus(resData, orderNo);
                    }
                    // if (resData.statusid === 4 || resData.statusid === 7 || resData.statusid === 5 || resData.statusid === 6) {
                    //     const isSuccess = resData.statusid === 4;
                    //     console.log(isSuccess ? "Payment Confirmed!" : "Payment Failed/Rejected!");

                    //     stopPolling();

                    //     const finalPayload = {
                    //         orderno: orderNo,
                    //         statusid: resData.statusid,
                    //         coinname: selectedCoin?.name || 'USDT',
                    //         networkname: selectedNetwork,
                    //         tranhash: resData.tranhash || "",
                    //         address: paymentData?.address || resData.address
                    //     };

                    //     try {
                    //         const depositRes = await api.post('/wallet/deposit', finalPayload);
                    //         const depositData = depositRes.data || depositRes;

                    //         if (depositRes.status === 200 || depositData.code === 200) {

                    //             const baseUrl = "http://192.168.100.123:5173/payment";
                    //             const targetUrl = isSuccess
                    //                 ? `${baseUrl}/success?orderno=${orderNo}`
                    //                 : `${baseUrl}/failed?orderno=${orderNo}`;

                    //             window.location.href = targetUrl;
                    //         }
                    //     } catch (depositErr) {
                    //         console.error("Error calling final deposit API:", depositErr);

                    //         if (resData.statusid === 7) {
                    //             window.location.href = `http://192.168.100.123:5173/payment/failed?orderno=${orderNo}`;
                    //         }
                    //     }
                    // }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        };

        checkStatus();
        pollingRef.current = setInterval(checkStatus, 15000);
    };

    if (!isOpen) return null;

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 300);
    };

    const handleOutsideClick = (e) => {
        if (e.target.classList.contains('payment-modal-overlay') || e.target.classList.contains('modal-scroll-wrapper')) {
            triggerShake();
        }
    };

    const handleCoinSelect = (coin) => {
        setSelectedCoin(coin);
        // setStep(2);
    };



    const handleNetworkSelect = (networkId) => {
        setSelectedNetwork(networkId);
        setApiError(null);
    };

    const handleConfirmPayment = async () => {
        if (!selectedNetwork) return;

        setLoading(true);
        setApiError(null);

        const deviceInfo = await getDeviceInfo();

        try {
            const bodyData = {
                amount: amount,
                network: selectedNetwork,
                coinname: selectedCoin?.name || 'USDT',
                device_info: deviceInfo,
            };


            const response = await api.post('/wallet/before_deposit', bodyData);


            const resData = response.data || response;
            const data = resData?.data || resData;

            console.log("Deposit Data Received:", data);

            // Check for API error response with status false
            if (resData.status === false || data?.status === false) {
                const errorMsg = resData.message || data?.message || "Deposit stopped or failed";
                setApiError(errorMsg);
                triggerShake();
                setLoading(false);
                return;
            }


            if (data && (data.status === "success" || data.code === 201 || data.status === true)) {
                if (data.address) {

                    setPaymentData(data);

                    setStep(3);


                    startStatusPolling(data.orderno);


                } else {
                    console.error("No address found in response");
                    triggerShake();
                }
            } else {
                console.error("API failed validation", data);
                setApiError(data?.message || "Payment initiation failed");
                triggerShake();
            }
        } catch (error) {
            console.error("Payment Process Error:", error.response?.data || error.message);
            setApiError(error.response?.data?.message || error.message || "Payment initiation failed");
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds) => {
        if (seconds === null) return "Loading...";
        if (seconds <= 0) return "Expired";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCopy = async (text, type) => {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopyStatus(type);
            setTimeout(() => setCopyStatus(""), 2000);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            setCopyStatus(type);
            setTimeout(() => setCopyStatus(""), 2000);
        }
    };

    const handleCancelDeposit = async () => {
        if (!paymentData?.orderno) {
            onClose();
            return;
        }

        setLoading(true);
        try {

            await api.post('/wallet/canceldeposit', {
                orderno: paymentData.orderno
            });


            const statusRes = await api.post('/wallet/fetchdepositstatus', {
                orderno: paymentData.orderno
            });


            const statusData = statusRes.data?.data || statusRes.data;

            const deviceInfo = await getDeviceInfo();
            const finalPayload = {
                orderno: paymentData.orderno,

                statusid: statusData.statusid,
                coinname: selectedCoin?.name || 'USDT',
                networkname: selectedNetwork,
                tranhash: statusData.tranhash || "",
                address: paymentData.address,
                amount: statusData.amount || amount,
                device_info: deviceInfo,
            };

            const depositRes = await api.post('/wallet/deposit', finalPayload);
            const depositData = depositRes.data || depositRes;


            if (depositRes.status === 200 || depositData.code === 200) {
                console.log("Success:", depositData.message);

                stopPolling();

                clearPersistedData();

                // OLD CODE - Static URL redirects
                // const targetUrl = `${FRONT_URL}/payment/failed?orderno=${paymentData.orderno}`;
                // window.location.href = targetUrl;

                // New logic: dynamic redirect URL from API response directly
                const targetUrl = statusData?.failurl;
                window.location.href = targetUrl;
            } else {
                triggerShake();
            }

        } catch (error) {
            console.error("Error in cancel sequence:", error);
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleExpireDeposit = async () => {
        if (!paymentData?.orderno) return;

        setLoading(true);
        try {
            console.log("Timer hit zero. Notifying server of expiration...");


            await api.post('/wallet/expiredeposit', {
                orderno: paymentData.orderno
            });


            const statusRes = await api.post('/wallet/fetchdepositstatus', {
                orderno: paymentData.orderno
            });


            const statusData = statusRes.data?.data || statusRes.data;

            const deviceInfo = await getDeviceInfo();
            if (statusData && statusData.statusid === 6) {
                const finalPayload = {
                    orderno: paymentData.orderno,
                    statusid: statusData.statusid,
                    coinname: selectedCoin?.name || 'USDT',
                    networkname: selectedNetwork,
                    tranhash: statusData.tranhash || "",
                    address: paymentData.address,
                    amount: statusData.amount || amount,
                    device_info: deviceInfo,
                };

                const depositRes = await api.post('/wallet/deposit', finalPayload);
                console.log("Expiry recorded in deposit table:", depositRes.data);
            }

            stopPolling();

            clearPersistedData();

            // OLD CODE - Static URL redirects
            // const targetUrl = `${FRONT_URL}/payment/failed?orderno=${paymentData.orderno}`;
            // window.location.href = targetUrl;

            // New logic: dynamic redirect URL from API response directly
            const targetUrl = statusData?.expireurl || statusData?.failurl;
            window.location.href = targetUrl;

        } catch (error) {
            console.error("Failed in expiry sequence:", error);

            // OLD CODE - Static URL redirects
            // window.location.href = `${FRONT_URL}/payment/failed?orderno=${paymentData.orderno}`;

            // New logic fallback directly from API response
            const fallbackUrl = statusData?.expireurl || statusData?.failurl;
            window.location.href = fallbackUrl;
        } finally {
            setLoading(false);
        }
    };

    // STEP 1: COIN SELECTION
    const renderCoinStep = () => {
        const coins = [{ id: 'usdt', name: 'USDT', symbol: 'T', color: '#26A17B', amount: amount }];

        return (
            <div className="payment-body">
                <div className="amount-section">
                    <p className="label">YOU HAVE TO PAY</p>
                    <h2 className="amount-display">{amount} USD</h2>
                </div>
                {/* <div className="search-bar-wrapper">
                    <Search size={18} className="search-icon-modal" />
                    <input
                        type="text"
                        placeholder="Search"
                        className="modal-search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div> */}
                <div className="coin-list">

                    {filteredCoins.length > 0 ? (
                        filteredCoins.map(coin => (
                            <div
                                key={coin.id}
                                className={`coin-item ${selectedCoin?.id === coin.id ? 'selected-coin' : ''}`}
                                onClick={() => handleCoinSelect(coin)}
                            >
                                <div className="coin-info-left">
                                    <div className="coin-icon-circle" style={{ backgroundColor: coin.color }}>
                                        {coin.symbol}
                                    </div>
                                    <span className="coin-name">{coin.name}</span>
                                </div>
                                <div className="coin-info-right">
                                    <span className="coin-value">{coin.amount} {coin.name}</span>
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-coins">
                            <p>No coins found</p>
                        </div>
                    )}
                    {/* {coins.map(coin => (
                        <div
                            key={coin.id}
                            className={`coin-item ${selectedCoin?.id === coin.id ? 'selected-coin' : ''}`}
                            onClick={() => handleCoinSelect(coin)}
                        >
                            <div className="coin-info-left">
                                <div className="coin-icon-circle" style={{ backgroundColor: coin.color }}>{coin.symbol}</div>
                                <span className="coin-name">{coin.name}</span>
                            </div>
                            <div className="coin-info-right">
                                <span className="coin-value">{coin.amount} {coin.name}</span>
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    ))} */}
                </div>


                <div className="pay-button-container">
                    <button
                        className="main-pay-btn"
                        disabled={!selectedCoin}
                        onClick={() => setStep(2)}
                    >
                        {selectedCoin ? `Pay with ${selectedCoin.name}` : "Select a Coin"}
                    </button>
                </div>
            </div>
        );
    };

    // STEP 2: NETWORK SELECTION
    const renderNetworkStep = () => {
        const networks = [
            { id: "TRC20", title: "TRC20" },
            { id: "BEP20", title: "BEP20" }
        ];

        return (
            <div className="payment-body">
                <div className="amount-section">
                    <p className="label">PAYING WITH {selectedCoin?.name}</p>
                    <h2 className="amount-display">{amount} USD</h2>
                </div>

                <div className="selection-title">Select Network</div>

                <div className="network-list">
                    {networks.map((net) => (
                        <div
                            key={net.id}
                            className={`network-item-card ${selectedNetwork === net.id ? 'active' : ''}`}
                            onClick={() => handleNetworkSelect(net.id)}
                        >
                            <div className="network-info">
                                <h6 className="network-name">
                                    {net.title}

                                    {selectedNetwork === net.id}

                                </h6>
                                <p className="network-desc-value">{amount} {selectedCoin?.name || 'USDT'}</p>
                            </div>

                            <ChevronRight size={18} className="arrow-icon" />
                        </div>
                    ))}
                </div>

                <div className="pay-button-container">
                    {apiError && (
                        <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px', textAlign: 'center', fontWeight: '500' }}>
                            {apiError}
                        </div>
                    )}
                    <button
                        className="main-pay-btn"
                        disabled={!selectedNetwork || loading}
                        onClick={handleConfirmPayment}
                    >
                        {loading ? (
                            <div className="button-loader-container">

                                <span>Processing...</span>
                            </div>
                        ) : selectedNetwork ? (
                            `Pay with ${selectedCoin?.name}-${selectedNetwork}`
                        ) : (
                            "Select Network"
                        )}
                    </button>
                </div>


            </div>
        );
    };

    // STEP 3: QR CODE & ADDRESS
    const renderQRStep = () => {
        const walletAddress = paymentData?.address;
        return (
            <div className="payment-body">

                <div className="amount-section qr-amount">
                    <p className="label">SEND EXACTLY</p>
                    <h2 className="amount-display">{amount} {selectedCoin?.name}</h2>
                    <p className="network-badge">{selectedNetwork}</p>
                </div>


                <div className="timer-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '15px' }}>
                    <Clock size={16} color={timeLeft < 60 ? "#ef4444" : "#6b7280"} />
                    <span style={{ fontWeight: '600' }}>
                        Expires in: <span className="timer-count" style={{ color: timeLeft < 60 ? "#ef4444" : "inherit" }}>
                            {formatTime(timeLeft)}
                        </span>
                    </span>
                </div>

                <div className="qr-container" style={{ textAlign: 'center', padding: '20px' }}>
                    {walletAddress ? (
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${walletAddress}`}
                            alt="Payment QR"
                            style={{ border: '1px solid #eee', borderRadius: '8px' }}
                        />
                    ) : (
                        <p>Generating QR...</p>
                    )}
                </div>

                <div className="input-group-copy">
                    <label>Deposit Address</label>
                    <div className="input-wrapper" style={{ display: 'flex', position: 'relative', width: "100%" }}>
                        <input
                            className='payment_input'
                            type="text"
                            value={walletAddress || "Loading..."}
                            readOnly
                            style={{ width: '80%', paddingRight: '45px', textOverflow: 'ellipsis', textWrap: "nowrap" }}
                        />
                        <button
                            type="button"
                            disabled={!walletAddress}
                            className="copy-btn-new"
                            onClick={() => handleCopy(walletAddress, "address")}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {copyStatus === "address" ? (
                                <Check size={18} color="#22c55e" className="fade-in" />
                            ) : (
                                <Copy size={18} color="#6b7280" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="cancel-container">
                    <button
                        className="cancel-payment-btn"
                        onClick={handleCancelDeposit}
                        disabled={loading}
                    >
                        {loading ? "Cancelling..." : "Cancel Payment"}
                    </button>
                </div>


            </div>
        );
    };


    return (
        <div className="payment-modal-overlay" onClick={handleOutsideClick}>
            <div className="modal-scroll-wrapper">
                <div className={`payment-card-container ${shake ? 'shake-animation' : ''}`} onClick={e => e.stopPropagation()}>

                    <div className="payment-header">
                        <div className="brand-info">
                            <div className="brand-logo">
                                <img src={logo} alt="" />
                            </div>
                            <div>
                                <h4 className="brand-name">M5dex <span className="verified-check">✓</span></h4>

                                {step === 3 && paymentData?.orderno && (
                                    <p className="invoice-id">Order No: {paymentData.orderno}</p>
                                )}
                            </div>
                        </div>
                        {step < 3 && <button className="modal-close-x" onClick={onClose} disabled={loading}><X size={18} /></button>}
                    </div>


                    {step === 1 && renderCoinStep()}
                    {step === 2 && renderNetworkStep()}
                    {step === 3 && renderQRStep()}

                    <div className="payment-footer-shared">
                        <div className="ticket-divider">
                            <div className="divider-line"></div>
                            <div className="cutout left"></div>
                            <div className="cutout right"></div>
                        </div>

                        <div className="footer-content-area">
                            <p className="footer-note">
                                {step === 3
                                    ? "Transactions may take a few minutes to confirm."
                                    : "Currency cannot be changed after proceeding"
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CryptoDeposit;