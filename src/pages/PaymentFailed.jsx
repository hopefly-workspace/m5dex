import { useLocation, useSearchParams } from 'react-router-dom';
import '../styles/components/payment/FailedScreen.css';
import { useToast } from '../contexts/ToastContext';
import { useEffect, useRef } from 'react';
import api from '../services/api';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const PaymentFailed = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasCalledRef = useRef(false);
  const { showError, showSuccess } = useToast();
  const invoiceid = searchParams.get('invoiceno');
  const orderno = searchParams.get('orderno');
  const status = searchParams.get('status') || 'failed';
  const paymentData = location.state?.paymentData || null;
  const errorMessage = location.state?.errorMessage || null;
  const invoiceData = localStorage.getItem('payment_data') ? JSON.parse(localStorage.getItem('payment_data')) : null;

  // comment this api calling : in crypto deposit page already all deposit api , so no need to call in this page.
  // useEffect(() => {
  //   const callDepositAPI = async () => {
  //     if (!invoiceid || !orderno) {
  //       return;
  //     }

  //     if (hasCalledRef.current) return;
  //     hasCalledRef.current = true;

  //     const deviceInfo = await getDeviceInfo();
  //     try {
  //       const response = await api.post('/wallet/deposit', {
  //         invoiceid: invoiceData?.invoiceid || invoiceid,
  //         orderno: orderno,
  //         status: 'Reject',
  //         device_info: deviceInfo,
  //       });
  //       if (
  //         response.code === 200 ||
  //         response.status === 'success' ||
  //         response.status === true ||
  //         response.status === "true"
  //       ) {
  //         showSuccess(response?.message || 'Deposit status updated successfully');
  //       } else {
  //         showError(response?.message);
  //         throw new Error(response.message || 'Failed to update deposit status');
  //       }
  //     } catch (error) {
  //       const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update deposit status. Please try again.';
  //       showError(errorMsg);
  //     } finally {
  //       localStorage.removeItem('payment_data');
  //     }
  //   };

  //   if (invoiceid && orderno) {
  //     callDepositAPI();
  //   }
  // }, [invoiceid, orderno, status]);

  const handleGoToDashboard = () => {
    window.location.replace(`${window.location.origin}/dashboard`);
  };

  const handleRetry = () => {
    window.location.replace(`${window.location.origin}/pay-through-deposit`);
  };

  return (
    <div className="failed-screen">
      <div className="failed-screen-container">
        <div className="failed-screen-card">
          <div className="failed-screen-content">
            <div className="failed-screen-icon-wrapper">
              <div className="failed-screen-icon-circle">
                <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <circle cx="19" cy="19" r="17.8" stroke="currentColor" strokeWidth="2.4" />
                  <line x1="12" y1="12" x2="26" y2="26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  <line x1="26" y1="12" x2="12" y2="26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </div>
              <div className="failed-screen-icon-glow"></div>
            </div>
            <h1 className="failed-screen-title">Payment Failed</h1>
            <p className="failed-screen-subtitle">
              {errorMessage || 'Your payment could not be processed. Please try again.'}
            </p>
          </div>

          <div className="failed-screen-body">
            <div className="failed-screen-info-item failed-screen-info-item-transaction">
              <div className="failed-screen-info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="failed-screen-info-content">
                <span className="failed-screen-info-label">Transaction ID</span>
                <span className="failed-screen-info-value failed-screen-info-value-id" title={paymentData?.paymentId || invoiceid || orderno || 'N/A'}>
                  {paymentData?.paymentId || invoiceid || orderno || 'N/A'}
                </span>
              </div>
            </div>

            <div className="failed-screen-info-item failed-screen-info-item-status">
              <div className="failed-screen-info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="failed-screen-info-content">
                <span className="failed-screen-info-label">Status</span>
                <span className="failed-screen-info-value status-badge status-badge-failed">
                  Failed
                </span>
              </div>
            </div>
          </div>

          <div className="failed-screen-footer">
            {/* <button
              className="failed-screen-primary-btn"
              onClick={handleGoToDashboard}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--ark-space-sm)' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Go to Dashboard
            </button> */}
            <button
              className="failed-screen-secondary-btn"
              onClick={handleRetry}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--ark-space-sm)' }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
