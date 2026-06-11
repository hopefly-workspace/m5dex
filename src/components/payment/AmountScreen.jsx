/**
 * Amount Input Screen Component
 * Separate screen for amount input step
 */

import '../../styles/components/payment/AmountScreen.css';

const AmountScreen = ({
  amount,
  errorMessage,
  isLoading,
  onAmountChange,
  onProceed
}) => {
  return (
    <div className="amount-screen">
      <div className="amount-screen-container">
        <div className="amount-screen-card">
          <div className="amount_icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 60 60" fill="none">
              <path d="M49.5349 51H10.4652C9.65569 51 9.00009 50.337 9.00009 49.5185C9.00009 48.6999 9.65569 48.037 10.4652 48.037H49.5331C50.3425 48.037 50.9981 48.6999 50.9981 49.5185C50.9981 50.337 50.3425 51 49.5331 51H49.5349ZM51 43.5924C51 42.7738 50.3444 42.1109 49.5349 42.1109H10.4652C9.65569 42.1109 9.00009 42.7738 9.00009 43.5924C9.00009 44.4109 9.65569 45.0739 10.4652 45.0739H49.5331C50.3425 45.0739 50.9981 44.4109 50.9981 43.5924H51ZM12.9082 28.2827V39.1478H15.8383V28.2827H12.9082ZM44.1636 28.2827V39.1478H47.0938V28.2827H44.1636ZM49.1102 18.0158L32.4046 9.56947C30.8993 8.81018 29.1027 8.81018 27.5992 9.56947L10.8899 18.0158C9.72517 18.6047 9 19.79 9 21.1085V21.8622C9 23.7678 10.5328 25.3197 12.4191 25.3197H25.6047V19.8881C25.6047 17.438 27.5771 15.4435 30 15.4435C32.4228 15.4435 34.3952 17.438 34.3952 19.8881V25.3197H47.5808C49.4652 25.3197 50.9999 23.7697 50.9999 21.8622V21.1085C50.9999 19.7918 50.2749 18.6047 49.1102 18.0158ZM34.9447 28.1385C34.3715 27.5589 33.4449 27.5589 32.8735 28.1385L31.467 29.5608V19.8885C31.467 19.0699 30.8114 18.4069 30.0019 18.4069C29.1925 18.4069 28.5369 19.0699 28.5369 19.8885V29.5608L27.1304 28.1385C26.5572 27.5589 25.6305 27.5589 25.0591 28.1385C24.4859 28.7182 24.4859 29.6552 25.0591 30.2331L27.5845 32.7868C28.2512 33.4609 29.1265 33.798 30.0019 33.798C30.8773 33.798 31.7526 33.4609 32.4192 32.7868L34.9446 30.2331C35.5179 29.6534 35.5179 28.7164 34.9447 28.1385Z" fill="white" />
            </svg>
          </div>
          <div className="amount-screen-header">
            <h1 className="amount-screen-title">Pay Through Deposit</h1>
            <p className="amount-screen-subtitle">Enter the amount you want to deposit</p>
          </div>

          <div className="amount-screen-form">
            <div className="amount-screen-amount-group">
              <label className="amount-screen-label">Amount (USD)</label>
              <div className="amount-screen-input-wrapper">
                <span className="amount-screen-currency">$</span>
                <input
                  type="text"
                  className={`amount-screen-input ${errorMessage ? 'error' : ''}`}
                  placeholder="0.00"
                  value={amount}
                  onChange={onAmountChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && amount && parseFloat(amount) > 0) {
                      onProceed();
                    }
                  }}
                  autoFocus
                />
              </div>
              {errorMessage && (
                <span className="amount-screen-error">{errorMessage}</span>
              )}
              <p className="amount-screen-helper">
                Minimum amount: $1.00
              </p>
            </div>

            <button
              className="amount-screen-proceed-btn"
              onClick={onProceed}
              disabled={!amount || parseFloat(amount) <= 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', marginRight: 'var(--ark-space-sm)' }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Processing...
                </>
              ) : (
                'Proceed'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmountScreen;
