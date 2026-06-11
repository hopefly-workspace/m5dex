import { useEffect, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import '../../styles/components/payment/PaymentScreen.css';

const PaymentScreen = ({
  paymentData,
  amount,
  isProcessingPayment,
  onBack,
  onPayment
}) => {
  const { user } = useUser();
  const scriptsLoadedRef = useRef(false);
  const letspayInitializedRef = useRef(false);
  const [initError, setInitError] = useState(null);

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

  useEffect(() => {
    if (scriptsLoadedRef.current && window.letspay && paymentData && !letspayInitializedRef.current) {
      letspayInitializedRef.current = false;
      initializeLetspay();
    }
  }, [paymentData, amount, user]);

  const initializeLetspay = () => {
    if (!window.letspay) {
      setInitError('Payment system not ready. Please refresh the page.');
      return;
    }

    if (!paymentData) {
      setInitError('Payment data is missing. Please try again.');
      return;
    }

    const userEmail = user?.email;
    const paymentAmount = parseFloat(amount) || parseFloat(paymentData?.amount);
    const invoiceNo = paymentData?.invoiceid || paymentData?.paymentId;
    const merchantId = paymentData?.merchantid;
    const currency = paymentData?.currency || 'USD';

    const missingFields = [];
    if (!userEmail) missingFields.push('email');
    if (!paymentAmount || paymentAmount <= 0) missingFields.push('amount');
    if (!invoiceNo) missingFields.push('invoice number');
    if (!merchantId) missingFields.push('merchant ID');

    if (missingFields.length > 0) {
      setInitError(`Missing required payment information: ${missingFields.join(', ')}. Please try again.`);
      return;
    }

    try {
      const buttonContainer = document.getElementById('letspaybutton');
      if (buttonContainer) {
        buttonContainer.innerHTML = '';
      }

      window.letspay.init({
        "name": "Let'sPay",
        "amount": paymentAmount,
        "invoiceno": invoiceNo,
        "currency": currency,
        "email": userEmail,
        "merchantid": merchantId,
      });

      letspayInitializedRef.current = true;
      setInitError(null);
    } catch (error) {
      setInitError(`Payment initialization failed: ${error.message || 'Unknown error'}. Please try again.`);
      letspayInitializedRef.current = false;
    }
  };

  return (
    <div className="payment-screen">
      <div className="payment-screen-container">
        <div className="payment-screen-card">
          <div className="payment-screen-header">
            <button
              className="payment-screen-back-btn"
              onClick={onBack}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="amount_icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="60" height="59" viewBox="0 0 60 59" fill="none">
                <path d="M33.0001 20.0179C33.5495 20.0179 33.9995 19.5673 33.9995 19.0172C33.9995 18.4671 33.5495 18.0165 33.0001 18.0165H30.9994V17.0158C30.9994 16.4657 30.5494 16.0151 30 16.0151C29.4506 16.0151 29.0006 16.4657 29.0006 17.0158V18.0165H28.0012C26.9005 18.0165 26.0005 18.9178 26.0005 20.0199V22.0232C26.0005 23.1253 26.9005 24.0265 28.0012 24.0265H32.0007V26.0299H26.9999C26.4505 26.0299 26.0005 26.4805 26.0005 27.0306C26.0005 27.5807 26.4505 28.0313 26.9999 28.0313H29.0006V29.032C29.0006 29.5821 29.4506 30.0327 30 30.0327C30.5494 30.0327 30.9994 29.5821 30.9994 29.032V28.0313H31.9988C33.0995 28.0313 33.9995 27.1301 33.9995 26.0279V24.0246C33.9995 22.9225 33.0995 22.0213 31.9988 22.0213H27.9993V20.0179H33.0001Z" fill="white" />
                <path d="M24.0204 33.0349C23.471 33.0349 23.021 33.4855 23.021 34.0356C23.021 34.5857 23.471 35.0363 24.0204 35.0363C24.5698 35.0363 25.0198 34.5857 25.0198 34.0356C25.0198 33.4855 24.5698 33.0349 24.0204 33.0349Z" fill="white" />
                <path d="M35.8596 34.0376C35.8596 33.4875 35.4095 33.0369 34.8602 33.0369H27.9993C27.4499 33.0369 26.9999 33.4875 26.9999 34.0376C26.9999 34.5877 27.4499 35.0383 27.9993 35.0383H34.8602C35.4095 35.0383 35.8596 34.5877 35.8596 34.0376Z" fill="white" />
                <path d="M24.0204 38.0422C23.471 38.0422 23.021 38.4928 23.021 39.0429C23.021 39.593 23.471 40.0436 24.0204 40.0436C24.5698 40.0436 25.0198 39.593 25.0198 39.0429C25.0198 38.4928 24.5698 38.0422 24.0204 38.0422Z" fill="white" />
                <path d="M32.1994 40.0456C32.7488 40.0456 33.1988 39.595 33.1988 39.0449C33.1988 38.4948 32.7488 38.0442 32.1994 38.0442H27.9993C27.4499 38.0442 26.9999 38.4948 26.9999 39.0449C26.9999 39.595 27.4499 40.0456 27.9993 40.0456H32.1994Z" fill="white" />
                <path d="M32.2594 44.2211L29.9793 45.8339L27.5492 44.2117C27.2098 43.992 26.7785 43.992 26.4392 44.2117L23.9884 45.8432L21.5377 44.2117C21.1983 43.992 20.7671 43.992 20.4277 44.2117L18.9783 45.173L18.9801 14.0099C18.9801 13.2795 18.7701 12.598 18.4195 12.0065H38.9796C40.0803 12.0065 40.9803 12.9077 40.9803 14.0099V31.0333C40.9803 31.5834 41.4303 32.0341 41.9797 32.0341C42.5291 32.0341 42.9791 31.5834 42.9791 31.0333L42.981 14.0099C42.981 11.7963 41.1903 10.0051 38.9815 10.0051H14.9993C12.7886 10.0051 10.9998 11.7982 10.9998 14.0099V36.0388C10.9998 37.1409 11.8998 38.0421 13.0005 38.0421H17V47.0542C17 47.4241 17.2007 47.7658 17.5307 47.9348C17.8513 48.1056 18.2507 48.085 18.5601 47.8841L21.0108 46.2525L23.4615 47.8841C23.8009 48.1037 24.2322 48.1037 24.5716 47.8841L27.0223 46.2525L29.473 47.8841C29.6437 47.9948 29.833 48.0549 30.0224 48.0549C30.2118 48.0549 30.4331 47.9948 30.6018 47.8747L33.4425 45.862C33.8926 45.5409 34.0032 44.9213 33.6825 44.4707C33.3619 44.0201 32.7432 43.9094 32.2931 44.2304L32.2594 44.2211ZM12.9987 14.0101C12.9987 12.908 13.8987 12.0068 14.9994 12.0068C16.1001 12.0068 17.0001 12.908 17.0001 14.0101V36.039H13.0006L12.9987 14.0101Z" fill="white" />
                <path d="M42.0004 34.0376C38.1396 34.0376 35.0008 37.1825 35.0008 41.0464C35.0008 44.9122 38.1415 48.0551 42.0004 48.0551C45.8612 48.0551 49 44.9103 49 41.0464C49 37.1805 45.8593 34.0376 42.0004 34.0376ZM42.0004 46.0537C39.2403 46.0537 36.9996 43.8101 36.9996 41.0464C36.9996 38.2827 39.2403 36.039 42.0004 36.039C44.7605 36.039 47.0012 38.2827 47.0012 41.0464C47.0012 43.8101 44.7605 46.0537 42.0004 46.0537Z" fill="white" />
                <path d="M44.4509 38.153C43.9615 37.9033 43.3615 38.1023 43.1102 38.6036L41.7302 41.3673L40.7101 40.346C40.3201 39.9554 39.6901 39.9554 39.3001 40.346C38.9101 40.7365 38.9101 41.3673 39.3001 41.7579L41.3008 43.7612C41.4902 43.9508 41.7414 44.0522 42.0115 44.0522C42.0621 44.0522 42.1221 44.0522 42.1708 44.0428C42.4915 43.9921 42.7615 43.7931 42.9002 43.5021L44.9009 39.4974C45.1503 39.0073 44.9516 38.4065 44.4509 38.1549L44.4509 38.153Z" fill="white" />
              </svg>
            </div>
            <h1 className="payment-screen-title">Complete Payment</h1>
            <p className="payment-screen-subtitle">Review your payment details and proceed</p>
          </div>

          <div className="payment-screen-payment-details">
            <div className="payment-screen-detail-row">
              <span className="payment-screen-detail-label">Amount</span>
              <span className="payment-screen-detail-value">
                ${amount ? parseFloat(amount).toFixed(2) : paymentData?.amount?.toFixed(2) || '0.00'}
              </span>
            </div>
            <div className="payment-screen-detail-row">
              <span className="payment-screen-detail-label">Currency</span>
              <span className="payment-screen-detail-value">
                {paymentData?.currency || 'USD'}
              </span>
            </div>
            <div className="payment-screen-detail-row">
              <span className="payment-screen-detail-label">Payment ID</span>
              <span className="payment-screen-detail-value payment-id">
                {paymentData?.invoiceid || paymentData?.paymentId || 'N/A'}
              </span>
            </div>
          </div>

          <div className="payment-screen-payment-actions">
            <div id="letspaybutton" className="letspay-button-container">
              <span>Pay Using </span>
              <span><svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 43 43" fill="none">
                <rect width="43" height="43" fill="white" />
                <path d="M22 8L15 35H8V8H22Z" fill="#1AA47B" />
                <path d="M24.4998 29.0544C27.2846 29.0689 29.961 27.9766 31.9404 26.0177C33.9197 24.0589 35.0399 21.394 35.0544 18.6092C35.0689 15.8245 33.9766 13.1481 32.0178 11.1687C30.0589 9.18932 27.394 8.06917 24.6093 8.05465L24.5546 18.5545L24.4998 29.0544Z" fill="#1AA47B" />
              </svg></span>
              <span>Let’spay</span>

          </div>
          {initError && (
            <div className="payment-screen-error">
              <p>{initError}</p>
              <button
                type="button"
                className="payment-screen-retry-btn"
                onClick={() => {
                  letspayInitializedRef.current = false;
                  setInitError(null);
                  if (window.letspay && paymentData) {
                    initializeLetspay();
                  }
                }}
              >
                Retry
              </button>
            </div>
          )}
          {isProcessingPayment && (
            <div className="payment-screen-loading">
              <p>Processing payment...</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div >
  );
};

export default PaymentScreen;
