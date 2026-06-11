import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";
import { useLatestNotification } from "../../contexts/LatestNotificationContext";
import "../../styles/components/profile/Notifications.css";
import { useNavigate } from "react-router-dom";

const Notifications = () => {
  const { showSuccess, showError } = useToast();
  const { refresh: refreshLatest } = useLatestNotification() || {};
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showMarkAsReadDropdown, setShowMarkAsReadDropdown] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
    // navigate('/dashboard');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMarkAsReadDropdown(false);
      }
    };

    if (showMarkAsReadDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMarkAsReadDropdown]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    refreshLatest?.();
  }, [refreshLatest]);

  const parseNotificationMetadata = (rawMetadata) => {
    if (!rawMetadata) return {};
    if (typeof rawMetadata === "object") return rawMetadata;
    if (typeof rawMetadata !== "string") return {};

    const input = rawMetadata.trim();
    if (!input) return {};

    try {
      return JSON.parse(input);
    } catch {
      try {
        // Handle invalid JSON like: transferid:WT707271 (missing quotes)
        const repaired = input.replace(
          /:\s*([A-Za-z_][A-Za-z0-9_-]*)(\s*[,}])/g,
          ': "$1"$2'
        );
        return JSON.parse(repaired);
      } catch {
        return {};
      }
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/profile/settings/notificationhistory");
      const raw = response?.notifications ?? response?.data ?? response;
      const arr = Array.isArray(raw) ? raw : (raw?.notifications ?? []);
      setNotifications(Array.isArray(arr) ? arr : []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      showError("Failed to load notifications. Please try again.");
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationDisplay = (n) => {
    const type = String(n.activity_type || "").toLowerCase();
    const subtype = String(n.activity_subtype || "").replace(/_/g, " ");
    const meta = parseNotificationMetadata(n.metadata);
    const msg = meta.msg || "";

    const formatSubtype = (s) =>
      s
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

    let icon = "🔔";
    let color = "var(--brand-primary)";
    let title = formatSubtype(subtype) || "Notification";

    const details = [];
    if (meta.amount != null) details.push(meta.currency ? `${meta.amount} ${meta.currency}` : String(meta.amount));
    if (meta.invoiceid) details.push(`Invoice: ${meta.invoiceid}`);
    if (meta.orderno) details.push(`Order: ${meta.orderno}`);
    const extra = details.length ? ` (${details.join(", ")})` : "";
    const message = msg ? `${msg}${extra}` : details.join(". ") || "No details";

    let typeClass = "notificationsCardIcon--default";
    if (type === "security") {
      icon = "🔒";
      color = subtype.toLowerCase().includes("password") ? "var(--color-success)" : "var(--color-danger)";
      typeClass = "notificationsCardIcon--security";
    } else if (type === "deposit") {
      icon = "💰";
      const sub = subtype.toLowerCase();
      const isSuccess = sub.includes("success") || sub.includes("confirm");
      color = isSuccess ? "var(--color-success)" : "var(--color-warning)";
      typeClass = isSuccess ? "notificationsCardIcon--depositSuccess" : "notificationsCardIcon--deposit";
    } else if (type === "withdrawal") {
      icon = "💸";
      color = "var(--text-info)";
      typeClass = "notificationsCardIcon--withdrawal";
    } else if (type === "trade" || type === "order") {
      icon = "📊";
      color = "var(--brand-primary)";
      typeClass = "notificationsCardIcon--trade";
    }

    return { icon, color, title, message, typeClass };
  };

  const filteredNotifications = useMemo(() => {
    const readKey = (n) => n.isread ?? n.read;
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !readKey(n));
    if (filter === "read") return notifications.filter((n) => readKey(n));
    return notifications;
  }, [notifications, filter]);

  useEffect(() => {
    if (!filteredNotifications.length) {
      setSelectedNotificationId(null);
      return;
    }
    const hasSelected = filteredNotifications.some((n) => n.id === selectedNotificationId);
    if (!hasSelected) {
      setSelectedNotificationId(filteredNotifications[0]?.id ?? null);
    }
  }, [filteredNotifications, selectedNotificationId]);

  const selectedNotification = useMemo(
    () => filteredNotifications.find((n) => n.id === selectedNotificationId) || null,
    [filteredNotifications, selectedNotificationId]
  );
  const selectedNotificationMetadata = useMemo(
    () => (selectedNotification ? parseNotificationMetadata(selectedNotification.metadata) : {}),
    [selectedNotification]
  );

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/profile/settings/marknotification`, { id: notificationId });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isread: true } : n)),
      );
      // showSuccess("Notification marked as read");
      refreshLatest?.();
    } catch (error) {
      showError("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put("/profile/settings/markallnotification");
      setNotifications((prev) => prev.map((n) => ({ ...n, isread: true })));
      // showSuccess("All notifications marked as read");
      setShowMarkAsReadDropdown(false);
      refreshLatest?.();
    } catch (error) {
      showError("Failed to mark all notifications as read");
    }
  };

  const deleteNotification = async (notificationId) => {
    setDeletingNotificationId(notificationId);
    try {
      await api.put(`/profile/settings/notification`, { id: notificationId });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      // showSuccess("Notification deleted");
    } catch (error) {
      showError("Failed to delete notification");
    } finally {
      setDeletingNotificationId(null);
    }
  };

  const deleteAllRead = async () => {
    try {
      await api.put("/profile/settings/allnotification");
      setNotifications((prev) => prev.filter((n) => n.isread !== true && n.read !== true));
      // showSuccess("All read notifications deleted");
    } catch (error) {
      showError("Failed to delete read notifications");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="notificationsScreen">
        <div className="notificationsHero">
          <div className="notificationsHeroContent">
            <div className="notificationsHeroIcon notificationsSkeleton" />
            <div className="notificationsHeroText">
              <div className="notificationsSkeleton notificationsSkeletonTitle" />
              <div className="notificationsSkeleton notificationsSkeletonSub" />
            </div>
          </div>
        </div>
        <div className="notificationsBody">
          <div className="notificationsFiltersSkeleton" />
          <div className="notificationsListSkeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="notificationCardSkeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !(n.isread ?? n.read)).length;
  const readCount = Math.max(0, notifications.length - unreadCount);
  const totalCount = notifications.length;

  return (
    <div className="notificationsScreen">
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
      <div className="notificationsHero">
        <div className="notificationsHeroGlow" />
        <div className="notificationsHeroContent">
          <div className="notificationsHeroIcon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="notificationsHeroText">
            <h1 className="notificationsHeroTitle">Notifications</h1>
            <p className="notificationsHeroSub">
              {unreadCount > 0
                ? `${unreadCount} unread · Stay on top of your account activity`
                : "All caught up · Your activity history in one place"}
            </p>
            <div className="notificationsHeroStats" aria-label="Notifications summary">
              <span className="notificationsHeroStat">
                <strong>{totalCount}</strong> <span>Total</span> 
              </span>
              <span className="notificationsHeroStat notificationsHeroStat--unread">
                <strong>{unreadCount}</strong> <span>Unread</span> 
              </span>
              <span className="notificationsHeroStat">
                <strong>{readCount}</strong> <span> Read</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="notificationsBody">
        <div className="notificationsToolbar">
          <div className="notificationsFilterPills">
            <button
              className={`notificationsPill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`notificationsPill ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread {unreadCount > 0 && <span className="notificationsPillBadge">{unreadCount}</span>}
            </button>
            <button
              className={`notificationsPill ${filter === "read" ? "active" : ""}`}
              onClick={() => setFilter("read")}
            >
              Read
            </button>
          </div>
          <div className="notificationsToolbarActions" ref={dropdownRef}>
            <button
              className="notificationsToolbarBtn"
              onClick={() => setShowMarkAsReadDropdown(!showMarkAsReadDropdown)}
              aria-expanded={showMarkAsReadDropdown}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              Quick actions
            </button>
            {showMarkAsReadDropdown && (
              <div className="notificationsDropdown">
                <button onClick={markAllAsRead}>Mark all as read</button>
                <button onClick={deleteAllRead} className="notificationsDropdownDanger">Delete all read</button>
              </div>
            )}
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="notificationsEmpty">
            <div className="notificationsEmptyIcon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3 className="notificationsEmptyTitle">All clear</h3>
            <p className="notificationsEmptyText">
              {filter === "unread"
                ? "You're all caught up. No unread notifications."
                : filter === "read"
                  ? "No read notifications yet."
                  : "Notifications will appear here when you have account activity."}
            </p>
          </div>
        ) : (
          <div className="notificationsContentGrid">
            <div className="notificationsList">
              {filteredNotifications.map((notification) => {
                const display = getNotificationDisplay(notification);
                const isUnread = !(notification.isread ?? notification.read);
                const isSelected = selectedNotificationId === notification.id;
                return (
                  <article
                    key={notification.id}
                    className={`notificationsCard ${isUnread ? "unread" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedNotificationId(notification.id);
                      if (isUnread) markAsRead(notification.id);
                    }}
                  >
                    <div className={`notificationsCardIcon ${display.typeClass}`}>
                      <span className="notificationsCardIconEmoji">{display.icon}</span>
                    </div>
                    <div className="notificationsCardBody">
                      <div className="notificationsCardHead">
                        <h4 className="notificationsCardTitle">{display.title}</h4>
                        {isUnread && <span className="notificationsCardUnread" />}
                      </div>
                      {/* <p className="notificationsCardMessage">{display.message}</p> */}
                      <div className="notificationsCardMeta">
                        <span className="notificationsCardTime">
                          {formatDate(notification.ondate || notification.created_at || notification.timestamp)}
                        </span>
                        <span className="notificationsCardType">{notification.activity_type}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="notificationsCardAction"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isUnread) markAsRead(notification.id);
                        else deleteNotification(notification.id);
                      }}
                    disabled={deletingNotificationId === notification.id}
                      title={isUnread ? "Mark as read" : "Delete"}
                      aria-label={isUnread ? "Mark as read" : "Delete"}
                    >
                    {deletingNotificationId === notification.id ? (
                      <span className="btn-loader-text">
                        <span className="loader" />
                      </span>
                    ) : isUnread ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
            {/* {selectedNotification && (
              <aside className="notificationsDetailCard">
                <div className="notificationsDetailHead">
                  <div className={`notificationsCardIcon ${getNotificationDisplay(selectedNotification).typeClass}`}>
                    <span className="notificationsCardIconEmoji">{getNotificationDisplay(selectedNotification).icon}</span>
                  </div>
                  <div className="notificationsDetailTitleWrap">
                    <h3>{getNotificationDisplay(selectedNotification).title}</h3>
                    <span>{formatDate(selectedNotification.ondate || selectedNotification.created_at || selectedNotification.timestamp)}</span>
                  </div>
                </div>
                <p className="notificationsDetailMessage">{getNotificationDisplay(selectedNotification).message}</p>
                <div className="notificationsDetailMeta">
                  <div><strong>Type:</strong> {selectedNotification.activity_type || "Notification"}</div>
                  <div><strong>Subtype:</strong> {selectedNotification.activity_subtype || "—"}</div>
                  <div><strong>Status:</strong> {(selectedNotification.isread ?? selectedNotification.read) ? "Read" : "Unread"}</div>
                  {Object.entries(selectedNotificationMetadata).map(([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong> {value == null ? "—" : String(value)}
                    </div>
                  ))}
                </div>
                <div className="notificationsDetailActions">
                  {!(selectedNotification.isread ?? selectedNotification.read) && (
                    <button onClick={() => markAsRead(selectedNotification.id)}>Mark as read</button>
                  )}
                  <button
                    className="danger"
                    onClick={() => deleteNotification(selectedNotification.id)}
                    disabled={deletingNotificationId === selectedNotification.id}
                  >
                    {deletingNotificationId === selectedNotification.id ? (
                      <span className="btn-loader-text">
                        <span className="loader" />
                        Deleting...
                      </span>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </aside>
            )} */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
