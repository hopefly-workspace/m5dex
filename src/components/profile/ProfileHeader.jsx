/**
 * Profile Header Component
 * Sticky header for Profile & Settings pages
 * Features: Back button, title, breadcrumb, support button
 */

import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import '../../styles/components/profile/ProfileHeader.css';
import { useState } from 'react';
import darklogo from "../../../public/assets/img/m5dex-dark-logo.png"
import logo from "../../../public/assets/img/m5dex-light-logo.png"
import { useTheme } from '../../contexts/ThemeContext';

const ProfileHeader = ({
  // title = 'Profile & Settings',
  breadcrumbs = null,
  onSupportClick = null
}) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const {  isDark } = useTheme();

  const handleBack = () => {
    navigate(-1);
    // navigate('/dashboard');
  };

  const handleSupport = () => {
    if (onSupportClick) {
      onSupportClick();
    } else {
      // Default: Navigate to support or open modal
      navigate('/helpsupport');
    }
  };

  return (
    <header className="profileHeader">
      {/* Logo */}
      <div className="profileHeader-logo">
        <div className="header-logo-mark">
               <img style={{height:"100px"}} src={!isDark?darklogo:logo} alt="" />
                    </div>
        {!isMobile && (
          <h1
            className="logo-text "
          // onClick={() => navigate('/dashboard')}
          >
            {/* Global Trading */}
          </h1>
        )}
      </div>
      {/* Left Section - Back Button */}
      {/* <div className="profileHeaderLeft">
        <button
          className="profileBackButton"
          onClick={handleBack}
          title="Back to Dashboard"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      </div> */}

      {/* Center Section - Title and Breadcrumb */}
      {/* <div className="profileHeaderCenter">
        <h1 className="profileHeaderTitle">{title}</h1>
        {breadcrumbs && (
          // <nav className="profileBreadcrumb">
          <nav className="profileBreadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="breadcrumbItem">
                {index > 0 && <span className="breadcrumbSeparator">/</span>}
                {crumb.path ? (
                  <a
                    href={crumb.path}
                    className="breadcrumbLink"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(crumb.path);
                    }}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="breadcrumbCurrent">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div> */}

      {/* Right Section - Notification Bell & Support */}
      <div className="profileHeaderRight">
        <NotificationBell />
        <Link
          to="/helpsupport"
          className="profileSupportButton"
          onClick={handleSupport}
          title="Help & Support"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          <span className="supportButtonText">Help & Support</span>
        </Link>
      </div>
    </header>
  );
};

export default ProfileHeader;

