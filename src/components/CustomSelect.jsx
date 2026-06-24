import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

const CustomSelect = ({ value, onChange, className = '', disabled = false, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Extract options from children
  const options = React.Children.toArray(children)
    .filter(child => child && child.type === 'option')
    .map(child => ({
      value: child.props.value,
      label: child.props.children
    }));

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (e, selectedValue) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange({ target: { value: selectedValue } });
    }
    setIsOpen(false);
  };

  return (
    <div
      className={`custom-select-container ${className} ${disabled ? 'disabled' : ''}`}
      ref={containerRef}
      onClick={() => !disabled && setIsOpen(!isOpen)}
      {...props}
    >
      <div className="custom-select-trigger">
        <div className="custom-select-selected-value">
          {selectedOption ? selectedOption.label : 'Select...'}
        </div>
        <span className={`custom-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>
      {isOpen && (
        <ul className="custom-select-options" onClick={(e) => e.stopPropagation()}>
          {options && options.length > 0 ? (
            options.map((opt, idx) => (
              <li
                key={idx}
                className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
                onClick={(e) => handleSelect(e, opt.value)}
              >
                {opt.label}
              </li>
            ))
          ) : (
            <li className="custom-select-option disabled" style={{ cursor: 'default', color: 'var(--text-tertiary, #888)' }}>
              No options found
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
