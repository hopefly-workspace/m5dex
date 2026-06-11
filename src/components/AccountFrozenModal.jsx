import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/components/AccountFrozenModal.css";

const LOCK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const AccountFrozenModal = ({ onClose, onUnfreeze }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleUnfreeze = () => {
    onUnfreeze?.();
    navigate("/profile/security");
    onClose();
  };

  return (
    <div
      className="account-frozen-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-frozen-modal-title"
    >
      <div className="account-frozen-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="account-frozen-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="account-frozen-modal-icon">{LOCK_ICON}</div>
        <h2 id="account-frozen-modal-title" className="account-frozen-modal-title">
          Your account is frozen
        </h2>
        <p className="account-frozen-modal-subtitle">
          Trading and withdrawals are temporarily disabled on your account.
        </p>
        <div className="account-frozen-modal-notes">
          <p className="account-frozen-modal-notes-title">What this means:</p>
          <ul>
            <li>You cannot place new trades or withdraw funds until the account is unfrozen.</li>
            <li>Your existing positions and balance remain secure.</li>
            <li>To unfreeze, go to Profile then Security and complete the unfreeze verification.</li>
          </ul>
        </div>
        <div className="account-frozen-modal-actions">
          <button type="button" className="account-frozen-modal-btn secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="account-frozen-modal-btn primary" onClick={handleUnfreeze}>
            Unfreeze account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountFrozenModal;
