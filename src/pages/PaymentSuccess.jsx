import { useLocation, useSearchParams } from 'react-router-dom';
import '../styles/components/payment/SuccessScreen.css';
import { useToast } from '../contexts/ToastContext';
import { useEffect, useRef } from 'react';
import api from '../services/api';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const PaymentSuccess = () => {
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

  // comment this api calling : in crypto deposit page already all deposit api, so no need to call in this page.

  // useEffect(() => {
  //   const callDepositAPI = async () => {
  //     if (!invoiceid || !orderno) {
  //       return;
  //     }

  //     if (hasCalledRef.current) return;
  //     hasCalledRef.current = true;

  //     try {
  //       const deviceInfo = await getDeviceInfo();
  //       const response = await api.post('/wallet/deposit', {
  //         invoiceid: invoiceData?.invoiceid || invoiceid,
  //         orderno: orderno,
  //         status: "Confirm",
  //         device_info: deviceInfo,
  //       });

  //       if (response.success || response.status === 'success') {
  //         showSuccess('Deposit status updated successfully');
  //       } else {
  //         throw new Error(response.message || 'Failed to update deposit status');
  //       }
  //     } catch (error) {
  //       const errorMsg = error?.message || 'Failed to update deposit status. Please try again.';
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
    <div className="success-screen">
      <div className="success-screen-container">
        <div className="success-screen-card">
          <div className="success-screen-content">
            <div className="success-screen-icon-wrapper">
              <div className="success-screen-icon-circle">
                <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <circle cx="19" cy="19" r="17.8" stroke="#20AF49" stroke-width="2.4" />
                  <path d="M28.6772 9.54858C23.753 15.2877 19.665 21.3897 16.3286 27.8259C14.6497 24.4235 12.4349 21.4718 9.51514 19.1238C10.8069 19.1163 11.6503 19.1619 12.4106 19.447C13.3968 19.8169 14.2925 20.6179 15.7905 22.4998L16.2437 23.0691L16.6128 22.4412C18.8968 18.5575 21.4326 15.1981 24.1763 12.2693H24.1772C24.8628 11.5372 25.3625 11.0041 25.7837 10.6082C26.2026 10.2143 26.5184 9.98081 26.8257 9.83276C27.2858 9.6111 27.7746 9.55325 28.6772 9.54858Z" fill="#20AF49" stroke="#20AF49" />
                </svg>
              </div>
              <div className="success-screen-icon-glow"></div>
            </div>
            <h1 className="success-screen-title">Payment Successful!</h1>
            <p className="success-screen-subtitle">
              {errorMessage || 'Your transaction has been completed successfully.'}
            </p>

            {/* {isSubmitting && (
              <div className="failed-screen-api-status submitting">
                <p>Updating deposit status...</p>
              </div>
            )}
            {apiSuccess && (
              <div className="failed-screen-api-status success">
                <p>Deposit status updated successfully</p>
              </div>
            )}
            {apiError && (
              <div className="failed-screen-api-status error">
                <p>{apiError}</p>
              </div>
            )} */}
          </div>

          <div className="success-screen-body">
            <div className="success-screen-info-item success-screen-info-item-transaction">
              <div className="success-screen-info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="success-screen-info-content">
                <span className="success-screen-info-label">Transaction ID</span>
                <span className="success-screen-info-value success-screen-info-value-id" title={paymentData?.paymentId || invoiceid || orderno || 'N/A'}>
                  {paymentData?.paymentId || invoiceid || orderno || 'N/A'}
                </span>
              </div>
            </div>

            <div className="success-screen-info-item success-screen-info-item-status">
              <div className="success-screen-info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="success-screen-info-content">
                <span className="success-screen-info-label">Status</span>
                <span className="success-screen-info-value status-badge status-badge-success">
                  Confirm
                  {/* Completed */}
                </span>
              </div>
            </div>
          </div>

          <div className="success-screen-footer">
            <button
              className="success-screen-primary-btn"
              onClick={handleGoToDashboard}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--ark-space-sm)' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Go to Dashboard
            </button>
            <button
              className="success-screen-secondary-btn"
              onClick={handleRetry}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--ark-space-sm)' }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Make Another Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
