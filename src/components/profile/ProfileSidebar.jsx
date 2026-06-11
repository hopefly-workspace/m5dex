/**
 * Profile Sidebar Component
 * Vertical navigation sidebar for Profile & Settings pages
 * Features: Menu items with icons, badges, active states
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLatestNotification } from '../../contexts/LatestNotificationContext';
import {
  User,
  Check,
  ShieldCheck,
  Lock,
  Key,
  Link,
  Settings,
  Bell,
  BarChart3,
  CreditCard,
  Gift,
  ScrollText,
  FileText,
  LockKeyhole,
  KeyRound
} from 'lucide-react';

import '../../styles/components/profile/ProfileSidebar.css';

const ProfileSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const { unreadCount = 0 } = useLatestNotification() || {};

  const menuItems = [
    {
      id: 'overview',
      label: 'Profile Overview',
      icon: User,
      path: '/profile',
      badge: null,
    },
    // {
    //   id: 'verification',
    //   label: 'Identity Verification',
    //   icon: Check,
    //   path: '/profile/verification',
    //   badge: 'New',
    // },
    {
      id: 'security',
      label: 'Security Settings',
      icon: LockKeyhole,
      path: '/profile/security',
      badge: null,
    },
    // {
    //   id: 'api',
    //   label: 'API Management',
    //   icon: KeyRound,
    //   path: '/profile/api',
    //   badge: null,
    // },
    // {
    //   id: 'exchanges',
    //   label: 'Connected Exchanges',
    //   icon: Link,
    //   path: '/profile/exchanges',
    //   badge: null,
    // },
    // {
    //   id: 'preferences',
    //   label: 'Preferences',
    //   icon: Settings,
    //   path: '/profile/preferences',
    //   badge: null,
    // },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      path: '/profile/notifications',
      badge: unreadCount > 0 ? unreadCount : null,
    },
    // {
    //   id: 'trading',
    //   label: 'Trading Settings',
    //   icon: BarChart3,
    //   path: '/profile/trading',
    //   badge: null,
    // },
    // {
    //   id: 'payment',
    //   label: 'Payment Methods',
    //   icon: CreditCard,
    //   path: '/profile/payment',
    //   badge: null,
    // },
    // {
    //   id: 'referral',
    //   label: 'Referral Program',
    //   icon: Gift,
    //   path: '/profile/referral',
    //   badge: null,
    // },
    // {
    //   id: 'activity',
    //   label: 'Activity Log',
    //   icon: ScrollText,
    //   path: '/profile/activity',
    //   badge: null,
    // },
    // {
    //   id: 'tax',
    //   label: 'Tax Reports',
    //   icon: FileText,
    //   path: '/profile/tax',
    //   badge: null,
    // },
  ];

  // Determine active item based on current path
  const getActiveItem = () => {
    const currentPath = location.pathname;
    // Exact match first
    const exactMatch = menuItems.find(item => item.path === currentPath);
    if (exactMatch) return exactMatch.id;

    // Check if current path starts with any menu item path
    const pathMatch = menuItems.find(item =>
      currentPath.startsWith(item.path) && item.path !== '/profile'
    );
    if (pathMatch) return pathMatch.id;

    // Default to overview
    return 'overview';
  };

  const handleItemClick = (item) => {
    navigate(item.path);
    // Scroll to top on mobile when navigating
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentActive = getActiveItem();

  return (
    <nav className="profileSidebar">
      {!isMobile && (
        <div className="profileSidebarHeader">
          <span className="profileSidebarTitle">Profile</span>
        </div>
      )}
      <ul className="profileSidebarList">
        {menuItems.map((item) => {
          const isActive = currentActive === item.id;
          return (
            <li key={item.id} className="profileSidebarItem">
              <button
                className={`profileSidebarButton ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item)}
                title={item.label}
              >
                {/* <span className="sidebarIcon">{item.icon}</span> */
                  <span className="sidebarIcon">
                    <item.icon size={18} strokeWidth={1.8} />
                  </span>
                }
                <span className="sidebarLabel">{item.label}</span>
                {item.badge && (
                  <span className="sidebarBadge">
                    {typeof item.badge === 'number' ? item.badge : item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default ProfileSidebar;

