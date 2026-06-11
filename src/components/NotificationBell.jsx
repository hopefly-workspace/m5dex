/**
 * NotificationBell
 * Global header indicator for latest unread notification.
 * Shows bell with badge when there's an unread notification.
 * Click navigates to /profile/notifications
 */

import { useNavigate } from "react-router-dom";
import { useLatestNotification } from "../contexts/LatestNotificationContext";
import "../styles/components/NotificationBell.css";

const NotificationBell = () => {
  const navigate = useNavigate();
  const ctx = useLatestNotification();
  if (!ctx) return null;
  const { hasUnread } = ctx;

  const handleClick = () => {
    navigate("/profile/notifications");
  };

  return (
    <button
      type="button"
      className="notificationBell"
      onClick={handleClick}
      title={hasUnread ? "You have a new notification" : "Notifications"}
      aria-label={hasUnread ? "New notification - View notifications" : "View notifications"}
    >
      <svg
        className="notificationBellIcon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread && <span className="notificationBellBadge" aria-hidden="true" />}
    </button>
  );
};

export default NotificationBell;
