import '../../styles/landing/PhoneMockup.css';

const PhoneMockup = () => {
  return (
    <div className="phone-mockup">
      <div className="phone-frame">
        <div className="phone-screen">
          {/* Status Bar */}
          <div className="phone-status-bar">
            <span className="status-time">9:41</span>
            <div className="status-icons">
              <span className="status-icon">📶</span>
              <span className="status-icon">📶</span>
              <span className="status-icon">🔋</span>
            </div>
          </div>

          {/* Trading Interface */}
          <div className="trading-interface">
            {/* Crypto List */}
            <div className="crypto-list">
              <div className="crypto-item">
                <div className="crypto-icon">₿</div>
                <div className="crypto-info">
                  <div className="crypto-name">Bitcoin</div>
                  <div className="crypto-price">₹95,500</div>
                </div>
                <div className="crypto-change positive">+2.5%</div>
              </div>
              <div className="crypto-item">
                <div className="crypto-icon">Ξ</div>
                <div className="crypto-info">
                  <div className="crypto-name">Ethereum</div>
                  <div className="crypto-price">₹3,200</div>
                </div>
                <div className="crypto-change positive">+1.8%</div>
              </div>
            </div>

            {/* Price Display */}
            <div className="price-display">
              <div className="price-label">Current Price</div>
              <div className="price-value positive">₹95,500</div>
            </div>

            {/* Trading Stats */}
            <div className="trading-stats">
              <div className="stat-item">
                <div className="stat-label">Value</div>
                <div className="stat-value">₹263.30K</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Margin</div>
                <div className="stat-value">₹2,701.0</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">P&L</div>
                <div className="stat-value positive">₹27,718.9</div>
              </div>
            </div>

            {/* Percentages */}
            <div className="percentage-display">
              <div className="percentage-item">
                <span className="percentage-label">ROI</span>
                <span className="percentage-value positive">50.6%</span>
              </div>
              <div className="percentage-item">
                <span className="percentage-label">Margin</span>
                <span className="percentage-value">60.2%</span>
              </div>
            </div>

            {/* Trade Button */}
            <button className="trade-button">
              Trade with INR →
            </button>

            {/* Bottom Navigation */}
            <div className="bottom-nav">
              <div className="nav-icon active">📊</div>
              <div className="nav-icon">💼</div>
              <div className="nav-icon">📈</div>
              <div className="nav-icon">👤</div>
              <div className="nav-icon">⚙️</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMockup;

