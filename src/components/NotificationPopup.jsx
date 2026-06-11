/**
 * NotificationPopup
 * Shows a toast-like popup when a new notification arrives.
 * Click navigates to /profile/notifications and dismisses.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/components/NotificationPopup.css";

const getDisplay = (n) => {
  if (!n) return { title: "Notification", message: "", icon: "🔔" };
  const type = String(n.activity_type || "").toLowerCase();
  const subtype = String(n.activity_subtype || "").replace(/_/g, " ");
  const meta = n.metadata || {};
  const msg = meta.msg || "";

  const formatSubtype = (s) =>
    s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const details = [];
  if (meta.amount != null) details.push(meta.currency ? `${meta.amount} ${meta.currency}` : String(meta.amount));
  if (meta.invoiceid) details.push(`Invoice: ${meta.invoiceid}`);
  const extra = details.length ? ` (${details.join(", ")})` : "";
  const message = msg ? `${msg}${extra}` : details.join(". ") || "New activity";

  let icon = "🔔";
  if (type === "security") icon = "🔒";
  else if (type === "deposit") icon = "💰";
  else if (type === "withdrawal") icon = "💸";
  else if (type === "trade" || type === "order") icon = "📊";

  return {
    title: formatSubtype(subtype) || "Notification",
    message,
    icon,
  };
};

const NotificationPopup = ({ notification, onDismiss }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => onDismiss?.(), 5000);
    return () => clearTimeout(t);
  }, [notification, onDismiss]);

  const handleClick = () => {
    onDismiss?.();
    navigate("/profile/notifications");
  };

  if (!notification) return null;

  const { title, message, icon } = getDisplay(notification);

  return (
    <div
      className="notificationPopup"
      role="alert"
      onClick={handleClick}
    >
      <button
        type="button"
        className="notificationPopupClose"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
        }}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="notificationPopupIcon">{icon}</div>
      <div className="notificationPopupBody">
        <div className="notificationPopupTitle">{title}</div>
        <div className="notificationPopupMessage">{message}</div>
        <div className="notificationPopupHint">Tap to view all notifications</div>
      </div>
    </div>
  );
};

export default NotificationPopup;
