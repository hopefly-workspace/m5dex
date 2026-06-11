/**
 * Country Code Selector Component
 * Premium modal-based country code selector
 */

import { useState, useRef, useEffect } from 'react';
import '../styles/components/CountryCodeSelector.css';

const COUNTRIES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
];

const CountryCodeSelector = ({ value, onChange, className = '' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const modalRef = useRef(null);

  const selectedCountry = COUNTRIES.find(c => c.code === value) || COUNTRIES[0];

  const filteredCountries = COUNTRIES.filter(country =>
    country.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.includes(searchTerm)
  );

  // Handle Escape key and body scroll
  useEffect(() => {
    if (!isModalOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Auto-focus search input
  useEffect(() => {
    if (isModalOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [isModalOpen]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSearchTerm('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSearchTerm('');
  };

  const handleSelect = (country) => {
    onChange(country.code);
    handleCloseModal();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  return (
    <>
      <div className={`country-code-selector-wrapper ${className}`}>
      <button
        type="button"
          onClick={handleOpenModal}
          className="country-code-selector-button"
        >
          <span className="country-code-flag-display">{selectedCountry.flag}</span>
          <span className="country-code-display">{selectedCountry.code}</span>
        <svg
            className="country-code-arrow"
            width="16"
            height="16"
            viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
            strokeWidth="2"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      </div>

      {isModalOpen && (
        <div
          className="country-code-modal-overlay"
          onClick={handleOverlayClick}
        >
          <div 
            ref={modalRef}
            className="country-code-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="country-code-modal-header">
              <h2 className="country-code-modal-title">Select Country</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="country-code-modal-close"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="country-code-modal-search">
              <div className="country-code-search-container">
                <svg
                  className="country-code-search-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            <input
                  ref={searchInputRef}
              type="text"
                  placeholder="Search country or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                  className="country-code-search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="country-code-search-clear"
                    aria-label="Clear"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Country List */}
            <div className="country-code-modal-content">
              {filteredCountries.length === 0 ? (
                <div className="country-code-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p>No countries found</p>
                  <span>Try a different search</span>
          </div>
              ) : (
                <div className="country-code-list">
                  {filteredCountries.map((country) => {
                    const isSelected = value === country.code;
                    return (
              <button
                key={country.code}
                type="button"
                onClick={() => handleSelect(country)}
                        className={`country-code-item ${isSelected ? 'selected' : ''}`}
              >
                        <span className="country-code-item-flag">{country.flag}</span>
                        <div className="country-code-item-info">
                          <div className="country-code-item-name">{country.country}</div>
                          <div className="country-code-item-code">{country.code}</div>
                </div>
                        {isSelected && (
                          <svg 
                            className="country-code-item-check"
                            width="20" 
                            height="20" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CountryCodeSelector;
