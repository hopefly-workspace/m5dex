import { useState, useEffect } from 'react';
import '../../styles/components/profile/AccountActivitiesView.css';

const ACTIVITY_ICONS = {
  login: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  logout: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  password: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  '2fa': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  security: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  default: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
};

/** Mock activities. Replace with api.get('/v1/user/activities') when backend is ready. */
function getMockActivities() {
  const now = new Date();
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return [
    { id: '1', type: 'login', label: 'Login', description: 'Successful sign-in', date: fmt(now), time: time(now), device: 'Chrome on Windows', ip: '192.168.1.1' },
    { id: '2', type: 'logout', label: 'Logout', description: 'Signed out', date: fmt(new Date(now - 86400000)), time: '2:32 PM', device: 'Chrome on Windows', ip: '192.168.1.1' },
    { id: '3', type: 'password', label: 'Password change', description: 'Login password updated', date: fmt(new Date(now - 2 * 86400000)), time: '10:15 AM', device: 'Safari on Mac', ip: '10.0.0.5' },
    { id: '4', type: '2fa', label: '2FA enabled', description: 'Two-factor authentication enabled', date: fmt(new Date(now - 5 * 86400000)), time: '9:00 AM', device: 'Chrome on Android', ip: '—' },
    { id: '5', type: 'login', label: 'Login', description: 'Successful sign-in', date: fmt(new Date(now - 7 * 86400000)), time: '6:45 PM', device: 'Firefox on Windows', ip: '192.168.1.1' },
    { id: '6', type: 'security', label: 'Passkey added', description: 'New passkey registered', date: fmt(new Date(now - 14 * 86400000)), time: '11:20 AM', device: 'Safari on iPhone', ip: '—' },
  ];
}

export default function AccountActivitiesView({ isOpen, onClose }) {
  const [activities] = useState(getMockActivities);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="activitiesViewOverlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activities-view-title"
    >
      <div className="activitiesView">
        <header className="activitiesViewHeader">
          <h2 id="activities-view-title" className="activitiesViewTitle">Account Activities</h2>
          <button
            type="button"
            className="activitiesViewClose"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <p className="activitiesViewDescription">
          Login and security activity history. If you see something you don’t recognize, secure your account.
        </p>
        <div className="activitiesViewBody">
          <ul className="activitiesList">
            {activities.map((a) => (
              <li key={a.id} className="activityCard">
                <div className={`activityCardIcon activityCardIcon--${a.type}`}>
                  {ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.default}
                </div>
                <div className="activityCardMain">
                  <div className="activityCardHead">
                    <span className="activityCardLabel">{a.label}</span>
                    <span className="activityCardMeta">{a.date} · {a.time}</span>
                  </div>
                  <p className="activityCardDescription">{a.description}</p>
                  <div className="activityCardFooter">
                    <span className="activityCardDevice">{a.device}</span>
                    <span className="activityCardIp">IP: {a.ip}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
