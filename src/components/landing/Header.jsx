import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Sun, Moon, Smartphone, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import '../../styles/landing/Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAppDownload, setShowAppDownload] = useState(false);
  const [showAlgoHubDropdown, setShowAlgoHubDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Markets');
  const [searchQuery, setSearchQuery] = useState('');
  const appDownloadRef = useRef(null);
  const algoHubRef = useRef(null);
  const moreRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAppDownload && appDownloadRef.current && !appDownloadRef.current.contains(event.target)) {
        setShowAppDownload(false);
      }
      if (showAlgoHubDropdown && algoHubRef.current && !algoHubRef.current.contains(event.target)) {
        setShowAlgoHubDropdown(false);
      }
      if (showMoreDropdown && moreRef.current && !moreRef.current.contains(event.target)) {
        setShowMoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAppDownload, showAlgoHubDropdown, showMoreDropdown]);

  const tradingNavItems = [
    { label: 'Markets', href: '/markets' },
    { label: 'Futures', href: '/markets?type=futures' },
    { label: 'Options', href: '/markets?type=options' },
    { label: 'Straddle', href: '/markets?type=straddle', badge: 'NEW' },
    // { label: 'Trackers', href: '/markets?type=trackers' },
    // { label: 'AlgoHub', href: '#', hasDropdown: true },
    // { label: 'More', href: '#', hasDropdown: true },
  ];

  const algoHubOptions = [
    { label: 'Strategy Builder', href: '/algohub/strategy-builder' },
    { label: 'Backtesting', href: '/algohub/backtesting' },
    { label: 'Paper Trading', href: '/algohub/paper-trading' },
    { label: 'Live Trading', href: '/algohub/live-trading' },
  ];

  const moreOptions = [
    { label: 'API Documentation', href: '/docs/api' },
    { label: 'Help Center', href: '/help' },
    { label: 'Community', href: '/community' },
    { label: 'Blog', href: '/blog' },
  ];

  return (
    <header className={`landing-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <div className="header-logo" onClick={() => navigate('/')}>
          <span className="logo-text">M5dex</span>
        </div>

        <nav className="header-nav desktop-nav">
          {tradingNavItems.map((item, index) => (
            <div
              key={index}
              className={`nav-item-wrapper ${item.hasDropdown ? 'has-dropdown' : ''}`}
              ref={item.label === 'AlgoHub' ? algoHubRef : item.label === 'More' ? moreRef : null}
              onMouseEnter={() => {
                if (item.hasDropdown && item.label === 'AlgoHub') {
                  setShowAlgoHubDropdown(true);
                } else if (item.hasDropdown && item.label === 'More') {
                  setShowMoreDropdown(true);
                }
              }}
              onMouseLeave={() => {
                if (item.label === 'AlgoHub') {
                  setShowAlgoHubDropdown(false);
                } else if (item.label === 'More') {
                  setShowMoreDropdown(false);
                }
              }}
            >
              <a
                href={item.href}
                className={`nav-item ${activeNavItem === item.label ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.hasDropdown) {
                    if (item.label === 'AlgoHub') {
                      setShowAlgoHubDropdown(!showAlgoHubDropdown);
                    } else if (item.label === 'More') {
                      setShowMoreDropdown(!showMoreDropdown);
                    }
                  } else {
                    setActiveNavItem(item.label);
                    navigate(item.href);
                  }
                }}
              >
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
                {item.hasDropdown && <ChevronDown size={14} className="nav-chevron" />}
              </a>
              {item.hasDropdown && item.label === 'AlgoHub' && (
                <AnimatePresence>
                  {showAlgoHubDropdown && (
                    <motion.div
                      className="nav-dropdown"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {algoHubOptions.map((option, optIndex) => (
                        <a
                          key={optIndex}
                          href={option.href}
                          className="dropdown-item"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(option.href);
                            setShowAlgoHubDropdown(false);
                          }}
                        >
                          {option.label}
                        </a>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
              {item.hasDropdown && item.label === 'More' && (
                <AnimatePresence>
                  {showMoreDropdown && (
                    <motion.div
                      className="nav-dropdown"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {moreOptions.map((option, optIndex) => (
                        <a
                          key={optIndex}
                          href={option.href}
                          className="dropdown-item"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(option.href);
                            setShowMoreDropdown(false);
                          }}
                        >
                          {option.label}
                        </a>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </nav>

        <div className="header-actions">
          <div className="header-search-wrapper">
            <input
              type="text"
              className="header-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === '/') {
                  e.preventDefault();
                  e.target.focus();
                }
              }}
            />
            <button className="search-shortcut-btn" type="button" aria-label="Search shortcut">
              <span className="search-shortcut">/</span>
            </button>
          </div>
          
          {/* Theme Toggle */}
          <button 
            className="header-theme-toggle" 
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* App Download */}
          <div className="app-download-wrapper" ref={appDownloadRef}>
            <button 
              className="header-app-download"
              onClick={() => setShowAppDownload(!showAppDownload)}
              aria-label="Download Mobile App"
            >
              <Smartphone size={18} />
              <span className="app-download-text">App</span>
              <ChevronDown size={14} className={`app-chevron ${showAppDownload ? 'open' : ''}`} />
            </button>
            <AnimatePresence>
              {showAppDownload && (
                <motion.div
                  className="app-download-dropdown"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <a
                    href="https://play.google.com/store/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-download-option"
                    onClick={() => setShowAppDownload(false)}
                  >
                    <div className="app-option-icon android">🤖</div>
                    <div className="app-option-content">
                      <div className="app-option-title">Android App</div>
                      <div className="app-option-subtitle">Download from Play Store</div>
                    </div>
                  </a>
                  <a
                    href="https://apps.apple.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-download-option"
                    onClick={() => setShowAppDownload(false)}
                  >
                    <div className="app-option-icon ios">🍎</div>
                    <div className="app-option-content">
                      <div className="app-option-title">iOS App</div>
                      <div className="app-option-subtitle">Download from App Store</div>
                    </div>
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="header-login" onClick={() => navigate('/login')}>Log In</button>
          <button className="header-signup" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
          >
            <nav className="mobile-nav">
              {tradingNavItems.map((item, index) => (
                <div key={index}>
                  <a
                    href={item.href}
                    className="mobile-nav-item"
                    onClick={(e) => {
                      e.preventDefault();
                      if (item.hasDropdown) {
                        const dropdown = e.target.nextElementSibling;
                        if (dropdown) {
                          dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                        }
                      } else {
                        setActiveNavItem(item.label);
                        navigate(item.href);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                  >
                    {item.label}
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                    {item.hasDropdown && <ChevronDown size={14} style={{ marginLeft: 'auto' }} />}
                  </a>
                  {item.hasDropdown && item.label === 'AlgoHub' && (
                    <div className="mobile-dropdown">
                      {algoHubOptions.map((option, optIndex) => (
                        <a
                          key={optIndex}
                          href={option.href}
                          className="mobile-dropdown-item"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(option.href);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          {option.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {item.hasDropdown && item.label === 'More' && (
                    <div className="mobile-dropdown">
                      {moreOptions.map((option, optIndex) => (
                        <a
                          key={optIndex}
                          href={option.href}
                          className="mobile-dropdown-item"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(option.href);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          {option.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="mobile-theme-toggle-wrapper">
                <button 
                  className="mobile-theme-toggle" 
                  onClick={toggleTheme}
                  aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  <span>Switch to {isDark ? 'Light' : 'Dark'} Theme</span>
                </button>
              </div>
              <div className="mobile-app-download-section">
                <div className="mobile-app-download-title">Download Mobile App</div>
                <a
                  href="https://play.google.com/store/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-app-option"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="app-option-icon android">🤖</div>
                  <div className="app-option-content">
                    <div className="app-option-title">Android App</div>
                    <div className="app-option-subtitle">Download from Play Store</div>
                  </div>
                </a>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-app-option"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="app-option-icon ios">🍎</div>
                  <div className="app-option-content">
                    <div className="app-option-title">iOS App</div>
                    <div className="app-option-subtitle">Download from App Store</div>
                  </div>
                </a>
              </div>
              <div className="mobile-actions">
                <button className="mobile-login" onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}>Log In</button>
                <button className="mobile-signup" onClick={() => { navigate('/signup'); setIsMobileMenuOpen(false); }}>Sign Up</button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;

