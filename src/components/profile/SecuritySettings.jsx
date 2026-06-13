import { useState, useCallback, useEffect } from "react";
import "../../styles/components/profile/SecuritySettings.css";
import { useUser } from "../../contexts/UserContext";
import { isPasskeySupported } from "../../utils/passkey";
import {
  checkPasskeySupport,
  registerPasskey,
  removePasskey,
} from "../../services/passkeyService";
import { api } from "../../services/api";
import { validatePassword } from "../../utils/security";
import { useLatestNotification } from "../../contexts/LatestNotificationContext";
import { useToast } from "../../contexts/ToastContext";
import AccountActivitiesView from "./AccountActivitiesView";
import DeviceManagementView from "./DeviceManagementView";
import OTPInput from "../OTPInput";
import { useNavigate } from "react-router-dom";
import { getDeviceInfo } from "../../utils/clientDeviceInfo";

const maskPhone = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 4) return phone;
  const last4 = cleaned.slice(-4);
  if (cleaned.length > 10 && cleaned.startsWith("91")) {
    const rest = cleaned.slice(2);
    return `+91 ${"*".repeat(Math.max(0, rest.length - 4))}${rest.slice(-4)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const rest = cleaned.slice(1);
    return `+1 ${"*".repeat(Math.max(0, rest.length - 4))}${rest.slice(-4)}`;
  }
  return `${"*".repeat(Math.max(0, cleaned.length - 4))}${last4}`;
};

const parsePhone = (phone) => {
  if (!phone || typeof phone !== "string") return { countryCode: "+91", number: "" };
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 10) return { countryCode: "+91", number: cleaned };
  if (cleaned.startsWith("91") && cleaned.length > 10) {
    return { countryCode: "+91", number: cleaned.slice(2) };
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return { countryCode: "+1", number: cleaned.slice(1) };
  }
  return { countryCode: "+91", number: cleaned.slice(-10) };
};

const maskEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}${domain}`;
};

const SecuritySettings = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useUser();
  const { refresh: refreshNotifications } = useLatestNotification() || {};
  const { showSuccess, showError } = useToast();
  const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState(null);
  const [passkeySuccess, setPasskeySuccess] = useState(null);
  const [activitiesViewOpen, setActivitiesViewOpen] = useState(false);
  const [deviceMgmtViewOpen, setDeviceMgmtViewOpen] = useState(false);

  const [mobileOtpOpen, setMobileOtpOpen] = useState(false);
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileResendTimer, setMobileResendTimer] = useState(0);
  const [mobileSending, setMobileSending] = useState(false);
  const [mobileVerifying, setMobileVerifying] = useState(false);
  const [mobileError, setMobileError] = useState(null);
  const [mobileSuccess, setMobileSuccess] = useState(null);
  const [mobileTempToken, setMobileTempToken] = useState(null);
  const [mobileParsed, setMobileParsed] = useState({ countryCode: "+91", number: "" });
  const [mobileMasked, setMobileMasked] = useState("");

  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [changePwdForm, setChangePwdForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [changePwdErrors, setChangePwdErrors] = useState({});
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [changePwdSuccess, setChangePwdSuccess] = useState(null);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [freezeOtpOpen, setFreezeOtpOpen] = useState(false);
  const [freezeOtp, setFreezeOtp] = useState("");
  const [freezeMode, setFreezeMode] = useState("freeze");
  const [freezeSending, setFreezeSending] = useState(false);
  const [freezeVerifying, setFreezeVerifying] = useState(false);
  const [freezeError, setFreezeError] = useState(null);
  const [freezeSuccess, setFreezeSuccess] = useState(null);
  const [freezeResendTimer, setFreezeResendTimer] = useState(0);
  const [accountFrozen, setAccountFrozen] = useState(user?.isfreeze);
  const [freezeConfirmModalOpen, setFreezeConfirmModalOpen] = useState(false);
  const [freezeConfirmAction, setFreezeConfirmAction] = useState(null);

  useEffect(() => {
    const frozen = user?.isfreeze ?? user?.isfreeze ?? false;
    setAccountFrozen(frozen);
  }, [user?.isfreeze]);

  const passkeyEnabled = !!user?.passkey_enabled;
  const passkeySupported = isPasskeySupported();

  // Google Authenticator (TOTP) 2FA
  const twoFaEnabled = !!user?.['2fa_enabled'];
  const [twoFaModalOpen, setTwoFaModalOpen] = useState(false);
  const [twoFaMode, setTwoFaMode] = useState('enable'); // 'enable' | 'disable'
  const [twoFaQrSrc, setTwoFaQrSrc] = useState(null);
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaVerifying, setTwoFaVerifying] = useState(false);
  const [twoFaDisabling, setTwoFaDisabling] = useState(false);
  const [twoFaError, setTwoFaError] = useState(null);
  const [twoFaSuccess, setTwoFaSuccess] = useState(null);

  const securityFeatures = [
    {
      id: "email",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={23}
          height={18}
          viewBox="0 0 23 18"
          fill="none"
        >
          <path
            d="M20.7558 0H2.24679C1.65156 0.00067842 1.08086 0.237157 0.659726 0.657628C0.238593 1.0781 0.00136014 1.64828 0 2.24325V15.7567C0.000681281 16.3519 0.237696 16.9225 0.658977 17.3431C1.08026 17.7637 1.65135 18 2.24679 18H20.7558C21.3508 17.9993 21.9212 17.7628 22.3419 17.3422C22.7627 16.9217 22.9993 16.3515 23 15.7567V2.23298C22.9966 1.64002 22.7587 1.07247 22.3383 0.654143C21.9179 0.235817 21.349 0.000668749 20.7558 0ZM19.9357 1.54176L11.6581 7.80642C11.6131 7.84101 11.558 7.85977 11.5013 7.85977C11.4446 7.85977 11.3894 7.84101 11.3445 7.80642L3.06684 1.54176H19.9357ZM20.7558 16.4582H2.24679C2.06042 16.4582 1.88165 16.3844 1.74963 16.2529C1.61761 16.1215 1.5431 15.943 1.54242 15.7567V2.31263L10.4113 9.03469C10.7244 9.27248 11.1068 9.40122 11.5 9.40122C11.8932 9.40122 12.2756 9.27248 12.5887 9.03469L21.4576 2.31263V15.7567C21.4576 15.8489 21.4394 15.9401 21.4042 16.0252C21.3689 16.1103 21.3172 16.1876 21.252 16.2528C21.1869 16.3179 21.1095 16.3696 21.0243 16.4048C20.9392 16.4401 20.8479 16.4582 20.7558 16.4582Z"
            fill="currentColor"
          />
        </svg>
      ),
      title: "Email Verification",
      tag: user?.email || 'ka***2@gmail.com',
      description:
        "Link your email address to your account for login, password recovery and withdrawal confirmation.",
      status: "on",
      value: user?.email,
      // action: "Change",
      is_veriftied: user?.email_verified,
    },
    {
      id: "google2fa",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a7 7 0 0 0-7 7v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a7 7 0 0 0-7-7Z" />
          <path d="M8 18v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" />
          <path d="M9.5 10.5h.01" />
          <path d="M14.5 10.5h.01" />
        </svg>
      ),
      title: "Google Authenticator (2FA)",
      tag: twoFaEnabled ? "On" : "Off",
      description: "Add an extra layer of security using an authenticator app (TOTP).",
      status: twoFaEnabled ? "on" : "off",
      value: twoFaEnabled ? "Enabled" : "Not enabled",
      action: twoFaEnabled ? "Disable 2FA" : "Enable 2FA",
      is_veriftied: twoFaEnabled,
    },
    // {
    //   id: "mobile",
    //   icon: (
    //     <svg
    //       xmlns="http://www.w3.org/2000/svg"
    //       width={15}
    //       height={23}
    //       viewBox="0 0 15 23"
    //       fill="none"
    //     >
    //       <path
    //         fillRule="evenodd"
    //         clipRule="evenodd"
    //         d="M15 2.3C15 1.68973 14.763 1.10477 14.3407 0.6739C13.9193 0.242267 13.347 0 12.75 0C10.1528 0 4.84725 0 2.25 0C1.653 0 1.08075 0.242267 0.65925 0.6739C0.237 1.10477 0 1.68973 0 2.3C0 6.2514 0 16.7486 0 20.7C0 21.3103 0.237 21.8952 0.65925 22.3261C1.08075 22.7577 1.653 23 2.25 23C4.84725 23 10.1528 23 12.75 23C13.347 23 13.9193 22.7577 14.3407 22.3261C14.763 21.8952 15 21.3103 15 20.7V2.3ZM3.95925 1.53333H2.25C2.05125 1.53333 1.86 1.61383 1.71975 1.75797C1.57875 1.90133 1.5 2.09683 1.5 2.3V20.7C1.5 20.9032 1.57875 21.0987 1.71975 21.242C1.86 21.3862 2.05125 21.4667 2.25 21.4667H12.75C12.9487 21.4667 13.14 21.3862 13.2803 21.242C13.4213 21.0987 13.5 20.9032 13.5 20.7V2.3C13.5 2.09683 13.4213 1.90133 13.2803 1.75797C13.14 1.61383 12.9487 1.53333 12.75 1.53333H11.0408L10.6327 2.78453C10.428 3.4109 9.855 3.83333 9.20925 3.83333H5.79075C5.145 3.83333 4.572 3.4109 4.36725 2.78453L3.95925 1.53333ZM6.75 20.7H8.25C8.664 20.7 9 20.3565 9 19.9333C9 19.5101 8.664 19.1667 8.25 19.1667H6.75C6.336 19.1667 6 19.5101 6 19.9333C6 20.3565 6.336 20.7 6.75 20.7ZM5.54025 1.53333L5.79075 2.3H9.20925L9.45975 1.53333H5.54025Z"
    //         fill="currentColor"
    //       />
    //     </svg>
    //   ),
    //   title: "Mobile Verification",
    //   tag: (user?.phone || user?.phone_number) ? maskPhone(user?.phone || user?.phone_number) : undefined,
    //   description:
    //     "Link your mobile number to your account to receive verification codes via SMS for confirmations on withdrawal, password change, and security settings.",
    //   status: user?.phone_verified ? "on" : "off",
    //   value: user?.phone || user?.phone_number,
    //   action: (user?.phone || user?.phone_number) && !user?.phone_verified ? "Verify" : "Set Up",
    //   is_veriftied: user?.phone_verified,
    // },
  ];

  const advancedSecurity = [
    {
      id: "password",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 29 29" fill="none">
          <path d="M22.4495 11.5039H21.5697V8.14761C21.5697 4.13874 18.6475 1 14.4686 1C10.2896 1 7.43033 4.20089 7.43033 8.14761V11.4728C7.43033 11.5039 7.43033 11.5039 7.43033 11.4728H6.55055C4.60246 11.4728 3.03142 13.0266 3 14.9845V25.4883C3 27.4151 4.57104 28.9689 6.55055 29H22.4495C24.3975 29 25.9686 27.4462 26 25.4883V14.9845C26 13.0577 24.3975 11.5039 22.4495 11.5039ZM9.18989 11.5039V8.14761C9.18989 5.16426 11.2637 2.74029 14.4686 2.74029C17.6421 2.74029 19.8101 5.10211 19.8101 8.14761V11.4728H9.18989V11.5039ZM24.209 25.4883C24.209 26.4517 23.4235 27.2286 22.4495 27.2286H6.55055C5.5765 27.2286 4.79098 26.4517 4.79098 25.4883V14.9845C4.79098 14.0211 5.5765 13.2442 6.55055 13.2442H22.4495C23.4235 13.2442 24.209 14.0211 24.209 14.9845V25.4883ZM16.2596 18.4961C16.2596 19.1487 15.9139 19.7081 15.3798 20.0189V22.8779C15.3798 23.3751 14.9713 23.7481 14.5 23.7481C13.9973 23.7481 13.6202 23.3441 13.6202 22.8779V20.0189C13.0861 19.7081 12.7404 19.1487 12.7404 18.4961C12.7404 17.5327 13.526 16.7558 14.5 16.7558C15.474 16.7248 16.2596 17.5017 16.2596 18.4961Z" fill="currentColor" />
        </svg>
      ),
      title: "Login Password",
      description: "Increase your password strength to enhance account security.",
      action: "Change",
    },
  ];

  const devicesActivities = [
    {
      id: "devices",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={23}
          height={23}
          viewBox="0 0 23 18"
          fill="none"
        >
          <path
            d="M22.9335 16.0544C22.9105 15.9935 22.8826 15.9296 22.8416 15.8607L22.8366 15.8537C22.8366 15.8537 22.8366 15.8527 22.8356 15.8527L20.2891 12.0063C20.2152 11.8945 20.0914 11.8276 19.9576 11.8276H3.04098C2.93716 11.8276 2.84033 11.8686 2.76646 11.9394C2.7455 11.9594 2.72553 11.9814 2.70956 12.0063L1.58651 13.7024L0.162974 15.8527C0.162974 15.8537 0.162974 15.8537 0.161976 15.8547L0.160978 15.8567C0.0361939 16.0543 -0.00273778 16.2181 0.000254806 16.3518C-0.00373828 16.5185 0.0391865 16.6942 0.13003 16.8529C0.275777 17.1065 0.510376 17.2572 0.756938 17.2572H22.2417C22.4883 17.2572 22.7228 17.1065 22.8686 16.8529C23.0183 16.5934 23.0403 16.288 22.9335 16.0544ZM14.1627 16.0374H8.83588L9.46578 15.085C9.47177 15.0771 9.48076 15.0721 9.49074 15.0721H13.5068C13.5168 15.0721 13.5258 15.0771 13.5318 15.086L14.1627 16.0374ZM2.45691 14.2056L3.37633 12.8329L19.6403 12.8429L20.5437 14.2066L2.45691 14.2056Z"
            fill="currentColor"
          />
          <path
            d="M3.30843 11.3543H19.691C20.0703 11.3543 20.3798 11.0459 20.3798 10.6655V0.688805C20.3798 0.309455 20.0713 0 19.691 0H3.30843C2.92908 0 2.61962 0.308458 2.61962 0.688805V10.6665C2.61962 11.0459 2.92808 11.3543 3.30843 11.3543ZM19.165 1.21584V10.1404L3.83462 10.1394V1.21587L19.165 1.21584Z"
            fill="currentColor"
          />
        </svg>
      ),
      title: "Device Management",
      description: "Manage devices that are allowed to access your account.",
      action: "Manage",
    },
  ];

  const openPasskeyModal = useCallback(() => {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setPasskeyModalOpen(true);
  }, []);

  const normalizeQrSrc = (qr) => {
    if (!qr) return null;
    // Backend sometimes returns base64 with whitespace/newlines.
    // `img src` fails on those, so strip all whitespace.
    const s = String(qr).replace(/\s+/g, '').trim();
    if (!s) return null;
    if (s.startsWith('data:image')) return s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    // If backend returns raw base64 without prefix.
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(s)) {
      return `data:image/png;base64,${s}`;
    }
    return s; // fallback (may be an URL)
  };

  const formatSecretKey = (secret) => {
    const s = String(secret || '').replace(/\s+/g, '');
    if (!s) return '';
    // Group for readability: XXXX XXXX XXXX
    return s.match(/.{1,4}/g)?.join(' ') || s;
  };

  const openTwoFaModal = useCallback(async () => {
    setTwoFaError(null);
    setTwoFaSuccess(null);
    setTwoFaCode('');
    setTwoFaQrSrc(null);
    setTwoFaSecret('');

    if (twoFaEnabled) {
      setTwoFaMode('disable');
      setTwoFaModalOpen(true);
      return;
    }

    setTwoFaMode('enable');
    setTwoFaModalOpen(true);

    // Industry approach: fetch QR + secret only when user opens setup UI.
    setTwoFaLoading(true);
    try {
      const res = await api.get('/auth/generate2fa');
      const payload = res?.data ?? res;

      const qr =
        payload?.qr_code ||
        payload?.qrCode ||
        payload?.qrCodeBase64 ||
        payload?.qrcode ||
        payload?.qr_code_base64 ||
        payload?.qr_code_img ||
        payload?.qr_code_img_base64 ||
        payload?.qr ||
        payload?.qr_code_img ||
        payload?.qrCodeImage ||
        payload?.qr_code_base64 ||
        payload?.qrCodeBase64;
      const secret =
        payload?.secret ||
        payload?.privatekey ||
        payload?.privateKey ||
        payload?.key ||
        payload?.manual_key ||
        payload?.otp_secret ||
        payload?.totp_secret ||
        payload?.base32_secret;

      setTwoFaQrSrc(normalizeQrSrc(qr));
      setTwoFaSecret(String(secret || ''));
    } catch (e) {
      setTwoFaError(e?.response?.data?.message || e?.message || 'Failed to initialize 2FA setup.');
      // Keep modal open so the user sees the error.
    } finally {
      setTwoFaLoading(false);
    }
  }, [twoFaEnabled]);

  const closePasskeyModal = useCallback(() => {
    if (!passkeyLoading) {
      setPasskeyModalOpen(false);
      setPasskeyError(null);
      setPasskeySuccess(null);
    }
  }, [passkeyLoading]);

  const closeTwoFaModal = useCallback(() => {
    if (twoFaLoading || twoFaVerifying || twoFaDisabling) return;
    setTwoFaModalOpen(false);
    setTwoFaError(null);
    setTwoFaSuccess(null);
    setTwoFaQrSrc(null);
    setTwoFaSecret('');
    setTwoFaCode('');
  }, [twoFaLoading, twoFaVerifying, twoFaDisabling]);

  const handleCopySecret = useCallback(() => {
    const text = String(twoFaSecret || '').trim();
    if (!text) return;
    // Try modern Clipboard API first, fall back to execCommand for non-HTTPS (local network)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showSuccess('2FA secret copied to clipboard'))
        .catch(() => copyViaExecCommand(text));
    } else {
      copyViaExecCommand(text);
    }

    function copyViaExecCommand(str) {
      const el = document.createElement('textarea');
      el.value = str;
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(el);
      el.select();
      el.setSelectionRange(0, str.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      if (ok) {
        showSuccess('2FA secret copied to clipboard');
      } else {
        showError('Copy failed. Please select and copy the secret manually.');
      }
    }
  }, [twoFaSecret, showSuccess, showError]);

  const handleVerifySetup = useCallback(
    async (codeValue) => {
      const code = String(codeValue || twoFaCode || '').trim();
      if (!code || code.length !== 6) {
        setTwoFaError('Please enter the 6-digit code.');
        return;
      }

      setTwoFaVerifying(true);
      setTwoFaError(null);
      setTwoFaSuccess(null);
      try {
        // Backend contract:
        // - /auth/2fa/enable2fa expects { privatekey, otp } to verify & enable.
        const res = await api.post('/auth/2fa/enable2fa', {
          privatekey: twoFaSecret,
          otp: code,
        });
        const payload = res?.data ?? res;
        const enabled =
          payload?.['2fa_enabled'] ??
          payload?.twoFaEnabled ??
          payload?.enabled ??
          null;
        setTwoFaSuccess(
          enabled === false
            ? payload?.message || '2FA could not be enabled.'
            : payload?.message || '2FA enabled successfully'
        );
        await refreshProfile();
        setTimeout(() => {
          closeTwoFaModal();
        }, 900);
      } catch (e) {
        setTwoFaError(
          e?.response?.data?.message ||
          e?.message ||
          'Invalid code. Please try again.'
        );
        setTwoFaCode('');
      } finally {
        setTwoFaVerifying(false);
      }
    },
    [twoFaCode, twoFaSecret, refreshProfile, closeTwoFaModal]
  );

  const handleDisable2FA = useCallback(
    async (codeValue) => {
      const code = String(codeValue ?? twoFaCode ?? '').trim();
      if (!code || code.length !== 6) {
        setTwoFaError('Enter the 6-digit code from your authenticator to disable 2FA.');
        return;
      }

      setTwoFaError(null);
      setTwoFaSuccess(null);
      setTwoFaDisabling(true);
      try {
        // Disable: send only TOTP code (no secret / private key).
        const res = await api.post('/auth/2fa/disable2fa', { otp: code });
        const payload = res?.data ?? res;
        if (payload?.['2fa_enabled'] === false || payload?.twoFaEnabled === false) {
          setTwoFaSuccess('2FA disabled successfully');
        } else {
          setTwoFaSuccess(payload?.message || '2FA disabled');
        }
        await refreshProfile();
        setTimeout(() => closeTwoFaModal(), 900);
      } catch (e) {
        setTwoFaError(
          e?.response?.data?.message || e?.message || 'Failed to disable 2FA.'
        );
        setTwoFaCode('');
      } finally {
        setTwoFaDisabling(false);
      }
    },
    [twoFaCode, refreshProfile, closeTwoFaModal]
  );

  const openActivitiesView = useCallback(() => setActivitiesViewOpen(true), []);
  const closeActivitiesView = useCallback(
    () => setActivitiesViewOpen(false),
    [],
  );
  const openDeviceMgmtView = useCallback(() => setDeviceMgmtViewOpen(true), []);
  const closeDeviceMgmtView = useCallback(
    () => setDeviceMgmtViewOpen(false),
    [],
  );

  const openChangePwdModal = useCallback(() => {
    setChangePwdForm({ current_password: "", new_password: "", confirm_password: "" });
    setChangePwdErrors({});
    setChangePwdSuccess(null);
    setChangePwdOpen(true);
  }, []);

  const closeChangePwdModal = useCallback(() => {
    if (!changePwdLoading) {
      setChangePwdOpen(false);
      setChangePwdForm({ current_password: "", new_password: "", confirm_password: "" });
      setChangePwdErrors({});
      setChangePwdSuccess(null);
    }
  }, [changePwdLoading]);

  const handleChangePwdSubmit = useCallback(async (e) => {
    e.preventDefault();
    const errs = {};
    if (!changePwdForm.current_password?.trim()) errs.current_password = "Current password is required";
    if (!changePwdForm.new_password?.trim()) errs.new_password = "New password is required";
    else {
      const v = validatePassword(changePwdForm.new_password);
      if (!v.isValid) errs.new_password = v.error;
    }
    if (!changePwdForm.confirm_password?.trim()) errs.confirm_password = "Please confirm your password";
    else if (changePwdForm.new_password !== changePwdForm.confirm_password) errs.confirm_password = "Passwords do not match";
    if (Object.keys(errs).length) {
      setChangePwdErrors(errs);
      return;
    }
    setChangePwdErrors({});
    setChangePwdLoading(true);

    try {

      const deviceInfo = await getDeviceInfo();

      await api.post("/users/change-password", {
        current_password: changePwdForm.current_password,
        new_password: changePwdForm.new_password,
        device_info: deviceInfo,
      });
      setChangePwdSuccess("Password changed successfully.");
      setChangePwdForm({ current_password: "", new_password: "", confirm_password: "" });
      refreshNotifications?.();
    } catch (e) {
      setChangePwdErrors({ general: e?.message || "Failed to change password. Please try again." });
    } finally {
      setChangePwdLoading(false);
    }
  }, [changePwdForm]);

  useEffect(() => {
    if (!changePwdOpen) return;
    const onEscape = (e) => { if (e.key === "Escape") closeChangePwdModal(); };
    window.addEventListener("keydown", onEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prev;
    };
  }, [changePwdOpen, closeChangePwdModal]);

  const sendMobileOtp = useCallback(
    async (countryCode, number) => {
      const num = (number || "").replace(/\D/g, "");
      if (!num) return;
      setMobileSending(true);
      setMobileError(null);
      try {
        const res = await api.post("/users/sendphoneotp", { phoneno: num });
        if (res?.temp_token) setMobileTempToken(res.temp_token);
        setMobileResendTimer(60);
      } catch (e) {
        setMobileError(e?.message || "Failed to send OTP. Please try again.");
      } finally {
        setMobileSending(false);
      }
    },
    [],
  );

  const openMobileOtpModal = useCallback(() => {
    const phone = user?.phone || user?.phone_number || "";
    if (!phone || user?.phone_verified) return;
    setMobileOtp("");
    setMobileError(null);
    setMobileSuccess(null);
    setMobileTempToken(null);
    setMobileResendTimer(0);
    const { countryCode, number } = parsePhone(phone);
    setMobileParsed({ countryCode, number });
    setMobileMasked(maskPhone(phone));
    setMobileOtpOpen(true);
    sendMobileOtp(countryCode, number);
  }, [user?.phone, user?.phone_number, user?.phone_verified, sendMobileOtp]);

  const closeMobileOtpModal = useCallback(() => {
    if (mobileVerifying || mobileSending) return;
    setMobileOtpOpen(false);
    setMobileOtp("");
    setMobileResendTimer(0);
    setMobileError(null);
    setMobileSuccess(null);
    setMobileTempToken(null);
  }, [mobileVerifying, mobileSending]);

  const handleMobileOtpComplete = useCallback(
    async (otpValue) => {
      if (!otpValue || otpValue.length !== 6 || mobileVerifying) return;
      setMobileVerifying(true);
      setMobileError(null);
      try {
        await api.post(
          "/auth/verify-otp",
          { otp: otpValue, verification_type: "phone" },
          { headers: { authorizationtoken: mobileTempToken || "" } },
        );
        await refreshProfile();
        setMobileSuccess("Mobile number verified successfully.");
      } catch (e) {
        setMobileError(e?.message || "Invalid OTP. Please try again.");
        setMobileOtp("");
      } finally {
        setMobileVerifying(false);
      }
    },
    [mobileVerifying, mobileTempToken, refreshProfile],
  );

  const handleMobileResend = useCallback(() => {
    if (mobileResendTimer > 0 || mobileSending) return;
    sendMobileOtp(mobileParsed.countryCode, mobileParsed.number);
    setMobileOtp("");
  }, [mobileResendTimer, mobileSending, mobileParsed, sendMobileOtp]);

  const sendFreezeOtp = useCallback(async (mode) => {
    const endpoint = mode === "unfreeze" ? "profile/settings/unfreeze" : "profile/settings/freeze";
    setFreezeSending(true);
    setFreezeError(null);
    try {
      const res = await api.get(`/${endpoint}`);
      const successMsg =
        res?.message ?? res?.data?.message ?? "OTP sent to your registered email. Please check your inbox.";
      setFreezeResendTimer(60);
      showSuccess(successMsg);
    } catch (e) {
      const msg =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Failed to send OTP. Please try again.";
      setFreezeError(msg);
      showError(msg);
    } finally {
      setFreezeSending(false);
    }
  }, [showSuccess, showError]);

  const openFreezeOtpModal = useCallback((mode) => {
    setFreezeMode(mode);
    setFreezeOtp("");
    setFreezeError(null);
    setFreezeSuccess(null);
    setFreezeResendTimer(0);
    setFreezeOtpOpen(true);
    sendFreezeOtp(mode);
  }, [sendFreezeOtp]);

  const closeFreezeOtpModal = useCallback(() => {
    if (freezeVerifying || freezeSending) return;
    setFreezeOtpOpen(false);
    setFreezeOtp("");
    setFreezeResendTimer(0);
    setFreezeError(null);
    setFreezeSuccess(null);
  }, [freezeVerifying, freezeSending]);

  const handleFreezeOtpComplete = useCallback(
    async (otpValue) => {
      if (!otpValue || otpValue.length !== 6 || freezeVerifying) return;
      const endpoint = freezeMode === "unfreeze" ? "profile/settings/unfreeze" : "profile/settings/freeze";
      setFreezeVerifying(true);
      setFreezeError(null);
      try {
        const response = await api.put(`/${endpoint}`, { otp: otpValue });
        await refreshProfile();
        setAccountFrozen(freezeMode === "freeze");
        const successMsg =
          response?.message ??
          response?.data?.message ??
          (freezeMode === "freeze"
            ? "Your account has been frozen. You can unfreeze it anytime from here."
            : "Your account has been unfrozen successfully.");
        setFreezeSuccess(successMsg);
        showSuccess(successMsg);
      } catch (e) {
        const msg =
          e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Invalid OTP. Please try again.";
        setFreezeError(msg);
        setFreezeOtp("");
        showError(msg);
      } finally {
        setFreezeVerifying(false);
      }
    },
    [freezeMode, freezeVerifying, refreshProfile, showSuccess, showError]
  );

  const handleFreezeResend = useCallback(() => {
    if (freezeResendTimer > 0 || freezeSending) return;
    sendFreezeOtp(freezeMode);
    setFreezeOtp("");
  }, [freezeResendTimer, freezeSending, freezeMode, sendFreezeOtp]);

  useEffect(() => {
    if (mobileResendTimer <= 0) return;
    const t = setInterval(() => setMobileResendTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [mobileResendTimer]);

  useEffect(() => {
    if (freezeResendTimer <= 0) return;
    const t = setInterval(() => setFreezeResendTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [freezeResendTimer]);

  useEffect(() => {
    if (!passkeyModalOpen) return;
    const onEscape = (e) => {
      if (e.key === "Escape") closePasskeyModal();
    };
    window.addEventListener("keydown", onEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [passkeyModalOpen, closePasskeyModal]);

  useEffect(() => {
    if (!mobileOtpOpen) return;
    const onEscape = (e) => {
      if (e.key === "Escape") closeMobileOtpModal();
    };
    window.addEventListener("keydown", onEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOtpOpen, closeMobileOtpModal]);

  useEffect(() => {
    if (!freezeOtpOpen) return;
    const onEscape = (e) => {
      if (e.key === "Escape") closeFreezeOtpModal();
    };
    window.addEventListener("keydown", onEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [freezeOtpOpen, closeFreezeOtpModal]);

  const handlePasskeySetup = async () => {
    setPasskeyError(null);
    setPasskeySuccess(null);
    try {
      checkPasskeySupport();
    } catch (e) {
      setPasskeyError(e.message);
      return;
    }

    setPasskeyLoading(true);
    try {
      await registerPasskey();
      await refreshProfile();
      setPasskeySuccess(
        "Passkey added successfully. You can now sign in with it.",
      );
    } catch (e) {
      setPasskeyError(e.message || "Passkey setup failed. Please try again.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasskeyRemove = async () => {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setPasskeyLoading(true);
    try {
      await removePasskey();
      await refreshProfile();
      setPasskeySuccess("Passkey removed successfully.");
    } catch (e) {
      setPasskeyError(
        e.message || "Could not remove passkey. Please try again.",
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    navigate(-1);
    // navigate('/dashboard');
  };

  return (
    <div className="securitySettings">
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
      <div>
        <h1 className="securityTitle">Security Settings</h1>
        <p className="mexcOverviewDescription">
          Control and manage security features
        </p>
      </div>
      <div className="securitySection">
        <h2 className="sectionTitle VeriBorder">Security Verification :</h2>
        {securityFeatures.map((feature) => (
          <div key={feature.id} className="securityFeatureRow">
            <div className="securityFeatureIcon">{feature.icon}</div>
            <div className="securityFeatureContent">
              <div className="securityFeatureHeader">
                <h3 className="securityFeatureTitle">{feature.title}</h3>
                {feature.tag && (
                  <span className="securityFeatureTag">{feature.tag}</span>
                )}
              </div>
              <p className="securityFeatureDescription">
                {feature.description}
              </p>
            </div>
            {feature.id === "passkey" ? (
              <>
                {/* {feature?.is_veriftied && (
                  <span className="securityFeatureStatus verified">
                    Verified
                  </span>
                )} */}
                <button
                  type="button"
                  className="securityActionBtn"
                  onClick={openPasskeyModal}
                  disabled={passkeyLoading}
                >
                  {feature.action}
                </button>
              </>
            ) : feature.id === "google2fa" ? (
              <>
                {/* {twoFaEnabled && (
                  <span className="securityFeatureStatus verified">Verified</span>
                )} */}
                <button
                  type="button"
                  className="securityActionBtn"
                  onClick={openTwoFaModal}
                  disabled={twoFaLoading || twoFaVerifying || twoFaDisabling}
                  title={
                    twoFaEnabled
                      ? "Disable Google Authenticator 2FA"
                      : "Set up Google Authenticator 2FA"
                  }
                >
                  {twoFaEnabled ? "Disable 2FA" : "Enable 2FA"}
                </button>
              </>
            ) : (
              <>
                {feature?.is_veriftied && (
                  <span className="mexcVerifiedBadge verified">
                    Verified
                  </span>
                )}
                {/* {feature?.is_veriftied && (
                  <button
                    type="button"
                    className="securityActionBtn"
                    onClick={
                      feature.id === "mobile" && (user?.phone || user?.phone_number)
                        ? openMobileOtpModal
                        : undefined
                    }
                    disabled={
                      feature.id === "mobile" && !(user?.phone || user?.phone_number)
                    }
                    title={
                      feature.id === "mobile" && !(user?.phone || user?.phone_number)
                        ? "Add mobile number in Profile first"
                        : undefined
                    }
                  >
                    {feature.action}
                  </button>
                )} */}
              </>
            )}
            {/* <button type="button" className="CloseButton">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={22}
                height={22}
                viewBox="0 0 28 28"
                fill="none"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M13.7886 12.3744L8.13173 6.71751C7.7414 6.32719 7.10784 6.32719 6.71751 6.71751C6.32719 7.10784 6.32719 7.7414 6.71751 8.13173L12.3744 13.7886L7.07107 19.0919C6.68074 19.4822 6.68074 20.1158 7.07107 20.5061C7.46139 20.8964 8.09496 20.8964 8.48528 20.5061L13.7886 15.2028L19.4454 20.8596C19.8358 21.25 20.4693 21.25 20.8596 20.8596C21.25 20.4693 21.25 19.8358 20.8596 19.4454L15.2028 13.7886L20.5061 8.48528C20.8964 8.09496 20.8964 7.46139 20.5061 7.07107C20.1158 6.68074 19.4822 6.68074 19.0919 7.07107L13.7886 12.3744Z"
                  fill="currentColor"
                />
              </svg>
            </button> */}
          </div>
        ))}
      </div>
      <div className="securitySection">
        <h2 className="sectionTitle VeriBorder">Advanced Security :</h2>
        {advancedSecurity.map((item) => (
          <div key={item.id} className="securityFeatureRow">
            <div className="securityFeatureIcon">{item.icon}</div>
            <div className="securityFeatureContent">
              <h3 className="securityFeatureTitle">{item.title}</h3>
              <p className="securityFeatureDescription">{item.description}</p>
            </div>
            <button
              type="button"
              className="securityActionBtn"
              onClick={item.id === "password" ? openChangePwdModal : undefined}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
      <div className="securitySection">
        <h2 className="sectionTitle VeriBorder">Account Freeze :</h2>
        <div className="securityFeatureRow">
          <div className="securityFeatureIcon">
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="securityFeatureContent">
            <h3 className="securityFeatureTitle">
              {accountFrozen ? "Unfreeze account" : "Freeze account"}
            </h3>
            <p className="securityFeatureDescription">
              {accountFrozen
                ? "Unfreeze your account to use trading and withdrawal again. We'll send an OTP to your registered email to verify."
                : "Temporarily freeze your account to block all trading and withdrawals. all trading, deposits and withdraw stopped. We'll send an OTP to your registered email to verify."}
            </p>
          </div>
          <button
            type="button"
            className={`securityActionBtn ${accountFrozen ? "" : "securityActionBtnDanger"}`}
            onClick={() => {
              setFreezeConfirmAction(accountFrozen ? "unfreeze" : "freeze");
              setFreezeConfirmModalOpen(true);
            }}
          >
            {accountFrozen ? "Unfreeze account" : "Freeze account"}
          </button>
        </div>
      </div>
      <div className="securitySection">
        <h2 className="sectionTitle VeriBorder">Devices and Activities :</h2>
        {devicesActivities.map((item) => (
          <div key={item.id} className="securityFeatureRow">
            <div className="securityFeatureIcon">{item.icon}</div>
            <div className="securityFeatureContent">
              <h3 className="securityFeatureTitle">{item.title}</h3>
              <p className="securityFeatureDescription">{item.description}</p>
            </div>
            <button
              type="button"
              className="securityActionBtn"
              onClick={
                item.id === "activities"
                  ? openActivitiesView
                  : item.id === "devices"
                    ? openDeviceMgmtView
                    : undefined
              }
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>

      <AccountActivitiesView
        isOpen={activitiesViewOpen}
        onClose={closeActivitiesView}
      />
      <DeviceManagementView
        isOpen={deviceMgmtViewOpen}
        onClose={closeDeviceMgmtView}
      />

      {mobileOtpOpen && (
        <div
          className="passkeyModalOverlay mobileOtpModalOverlay"
          onClick={(e) => e.target === e.currentTarget && closeMobileOtpModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-otp-modal-title"
        >
          <div
            className="passkeyModal mobileOtpModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="passkeyModalHeader">
              <h2 id="mobile-otp-modal-title" className="passkeyModalTitle">
                Verify mobile number
              </h2>
              <button
                type="button"
                className="passkeyModalClose"
                onClick={closeMobileOtpModal}
                disabled={mobileVerifying || mobileSending}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="passkeyModalBody">
              {mobileSuccess ? (
                <div className="passkeyMessage passkeySuccess">
                  <span>{mobileSuccess}</span>
                  <button
                    type="button"
                    className="passkeyModalBtn primary"
                    onClick={closeMobileOtpModal}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="passkeyModalText mobileOtpSubtitle">
                    {mobileSending && !mobileMasked
                      ? "Sending verification code…"
                      : mobileMasked
                        ? `We've sent a 6-digit code to ${mobileMasked}. Enter it below.`
                        : "Enter the 6-digit code sent to your mobile."}
                  </p>
                  {mobileError && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      {mobileError}
                    </div>
                  )}
                  <div className="mobileOtpInputWrap">
                    <OTPInput
                      value={mobileOtp}
                      onChange={setMobileOtp}
                      onComplete={handleMobileOtpComplete}
                      error={!!mobileError}
                      disabled={mobileVerifying || mobileSending}
                    />
                  </div>
                  <div className="mobileOtpResendRow">
                    <span className="mobileOtpResendLabel">
                      Didn't receive the code?
                    </span>
                    <button
                      type="button"
                      className="mobileOtpResendBtn"
                      onClick={handleMobileResend}
                      disabled={mobileResendTimer > 0 || mobileSending}
                    >
                      {mobileResendTimer > 0
                        ? `Resend in ${mobileResendTimer}s`
                        : "Resend code"}
                    </button>
                  </div>
                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closeMobileOtpModal}
                      disabled={mobileVerifying || mobileSending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="passkeyModalBtn primary"
                      onClick={() => handleMobileOtpComplete(mobileOtp)}
                      disabled={
                        mobileVerifying ||
                        mobileSending ||
                        mobileOtp.length !== 6
                      }
                    >
                      {mobileVerifying ? (
                        <>
                          <span className="passkeySpinner" />
                          Verifying…
                        </>
                      ) : (
                        "Verify"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {freezeConfirmModalOpen && (
        <div className="passkeyModalOverlay" onClick={() => setFreezeConfirmModalOpen(false)}>
          <div className="passkeyModal" onClick={(e) => e.stopPropagation()}>
            <div className="passkeyModalBody" style={{ textAlign: 'center', paddingTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: freezeConfirmAction === "unfreeze" ? "var(--color-success)" : "var(--color-danger)" }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h2 className="passkeyModalTitle" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>
                {freezeConfirmAction === "unfreeze" ? "Unfreeze Account" : "Account Freeze"}
              </h2>
              <p className="passkeyModalText" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                {freezeConfirmAction === "unfreeze"
                  ? "Temporarily unfreeze your account to prevent all trading, deposits, and withdrawals. To confirm this action, we'll send a verification OTP to your registered email address."
                  : "Temporarily freeze your account to prevent all trading, deposits, and withdrawals. To confirm this action, we'll send a verification OTP to your registered email address."}
              </p>
              <div className="passkeyModalActions" style={{ marginTop: '32px' }}>
                <button
                  type="button"
                  className="passkeyModalBtn secondary"
                  onClick={() => setFreezeConfirmModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="passkeyModalBtn primary"
                  onClick={() => {
                    setFreezeConfirmModalOpen(false);
                    openFreezeOtpModal(freezeConfirmAction);
                  }}
                >
                  Send Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {freezeOtpOpen && (
        <div
          className="passkeyModalOverlay mobileOtpModalOverlay"
          onClick={(e) => e.target === e.currentTarget && closeFreezeOtpModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="freeze-otp-modal-title"
        >
          <div
            className="passkeyModal mobileOtpModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="passkeyModalHeader">
              <h2 id="freeze-otp-modal-title" className="passkeyModalTitle">
                {freezeMode === "unfreeze" ? "Unfreeze account" : "Freeze account"}
              </h2>
              <button
                type="button"
                className="passkeyModalClose"
                onClick={closeFreezeOtpModal}
                disabled={freezeVerifying || freezeSending}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="passkeyModalBody">
              {freezeSuccess ? (
                <div className="passkeyMessage passkeySuccess">
                  <span>{freezeSuccess}</span>
                  <button
                    type="button"
                    className="passkeyModalBtn primary"
                    onClick={closeFreezeOtpModal}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="passkeyModalText mobileOtpSubtitle">
                    {freezeSending && !user?.email
                      ? "Sending OTP…"
                      : user?.email
                        ? `We've sent a 6-digit OTP to ${maskEmail(user.email)}. Enter it below to ${freezeMode === "unfreeze" ? "unfreeze" : "freeze"} your account.`
                        : "Enter the 6-digit OTP sent to your registered email."}
                  </p>
                  {freezeError && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      {freezeError}
                    </div>
                  )}
                  <div className="mobileOtpInputWrap">
                    <OTPInput
                      value={freezeOtp}
                      onChange={setFreezeOtp}
                      onComplete={handleFreezeOtpComplete}
                      error={!!freezeError}
                      disabled={freezeVerifying || freezeSending}
                    />
                  </div>
                  <div className="mobileOtpResendRow">
                    <span className="mobileOtpResendLabel">
                      Didn't receive the code?
                    </span>
                    <button
                      type="button"
                      className="mobileOtpResendBtn"
                      onClick={handleFreezeResend}
                      disabled={freezeResendTimer > 0 || freezeSending}
                    >
                      {freezeResendTimer > 0
                        ? `Resend in ${freezeResendTimer}s`
                        : "Resend code"}
                    </button>
                  </div>
                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closeFreezeOtpModal}
                      disabled={freezeVerifying || freezeSending}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`passkeyModalBtn ${freezeMode === "unfreeze" ? "primary" : "danger"}`}
                      onClick={() => handleFreezeOtpComplete(freezeOtp)}
                      disabled={
                        freezeVerifying ||
                        freezeSending ||
                        freezeOtp.length !== 6
                      }
                    >
                      {freezeVerifying ? (
                        <>
                          <span className="passkeySpinner" />
                          Verifying…
                        </>
                      ) : freezeMode === "unfreeze" ? (
                        "Unfreeze account"
                      ) : (
                        "Freeze account"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {passkeyModalOpen && (
        <div
          className="passkeyModalOverlay"
          onClick={(e) => e.target === e.currentTarget && closePasskeyModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="passkey-modal-title"
        >
          <div className="passkeyModal">
            <div className="passkeyModalHeader">
              <h2 id="passkey-modal-title" className="passkeyModalTitle">
                {passkeyEnabled ? "Manage passkey" : "Set up passkey"}
              </h2>
              <button
                type="button"
                className="passkeyModalClose"
                onClick={closePasskeyModal}
                disabled={passkeyLoading}
                aria-label="Close"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="passkeyModalBody">
              {passkeySuccess ? (
                <div className="passkeyMessage passkeySuccess">
                  <span>{passkeySuccess}</span>
                  <button
                    type="button"
                    className="passkeyModalBtn primary"
                    onClick={closePasskeyModal}
                  >
                    Done
                  </button>
                </div>
              ) : passkeyEnabled ? (
                <>
                  <p className="passkeyModalText">
                    Remove the passkey from your account. You will need your
                    password or other 2FA to sign in until you add a new
                    passkey.
                  </p>
                  {passkeyError && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      {passkeyError}
                    </div>
                  )}
                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closePasskeyModal}
                      disabled={passkeyLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="passkeyModalBtn danger"
                      onClick={handlePasskeyRemove}
                      disabled={passkeyLoading}
                    >
                      {passkeyLoading ? (
                        <>
                          <span className="passkeySpinner" />
                          Removing…
                        </>
                      ) : (
                        "Remove passkey"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {!passkeySupported && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      Passkeys are not supported in this browser. Use Chrome,
                      Safari, or Edge over HTTPS.
                    </div>
                  )}
                  <p className="passkeyModalText">
                    Use your device fingerprint, face, or security key to sign
                    in quickly and securely. You’ll be prompted to create a
                    passkey when you continue.
                  </p>
                  {passkeyError && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      {passkeyError}
                    </div>
                  )}
                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closePasskeyModal}
                      disabled={passkeyLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="passkeyModalBtn primary"
                      onClick={handlePasskeySetup}
                      disabled={passkeyLoading || !passkeySupported}
                    >
                      {passkeyLoading ? (
                        <>
                          <span className="passkeySpinner" />
                          Setting up…
                        </>
                      ) : (
                        "Set up passkey"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {twoFaModalOpen && (
        <div
          className="passkeyModalOverlay"
          onClick={(e) => e.target === e.currentTarget && closeTwoFaModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="twofa-modal-title"
        >
          <div className="passkeyModal twoFaModal">
            <div className="passkeyModalHeader">
              <h2 id="twofa-modal-title" className="passkeyModalTitle">
                {twoFaMode === "disable" ? "Disable Google Authenticator" : "Enable Google Authenticator"}
              </h2>
              <button
                type="button"
                className="passkeyModalClose"
                onClick={closeTwoFaModal}
                disabled={twoFaLoading || twoFaVerifying || twoFaDisabling}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="passkeyModalBody">
              {twoFaSuccess ? (
                <div className="passkeyMessage passkeySuccess">
                  <span>{twoFaSuccess}</span>
                  <button
                    type="button"
                    className="passkeyModalBtn primary"
                    onClick={closeTwoFaModal}
                    disabled={twoFaLoading || twoFaVerifying || twoFaDisabling}
                  >
                    Done
                  </button>
                </div>
              ) : twoFaMode === "disable" ? (
                <>
                  <p className="passkeyModalText">
                    Enter the 6-digit code from your authenticator to turn off Google Authenticator (2FA). Only this code is sent to the server — your secret key is not used.
                  </p>
                  <div
                    className="twoFaOtpWrap"
                    onKeyDownCapture={(e) => {
                      // Stop Ctrl+V from reaching OTPInput's handler which calls e.preventDefault()
                      // and uses navigator.clipboard.readText() (fails on non-HTTPS).
                      // Without preventDefault, browser fires paste event naturally → onPaste below catches it.
                      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
                        e.stopPropagation();
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData?.getData('text') || '';
                      const digits = text.replace(/\D/g, '').slice(0, 6);
                      if (digits) {
                        e.preventDefault();
                        setTwoFaCode(digits);
                        if (twoFaError) setTwoFaError(null);
                        if (digits.length === 6) handleDisable2FA(digits);
                      }
                    }}
                  >
                    <OTPInput
                      value={twoFaCode}
                      onChange={(code) => {
                        setTwoFaCode(code);
                        if (twoFaError) setTwoFaError(null);
                      }}
                      onComplete={handleDisable2FA}
                      error={!!twoFaError}
                      disabled={twoFaDisabling || twoFaVerifying}
                    />
                    {twoFaError && (
                      <div className="passkeyMessage passkeyError" role="alert">
                        {twoFaError}
                      </div>
                    )}
                  </div>
                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closeTwoFaModal}
                      disabled={twoFaDisabling || twoFaVerifying}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="passkeyModalBtn danger"
                      onClick={() => handleDisable2FA(twoFaCode)}
                      disabled={twoFaDisabling || twoFaVerifying || twoFaCode.length !== 6}
                    >
                      {twoFaDisabling ? (
                        <>
                          <span className="passkeySpinner" />
                          Disabling…
                        </>
                      ) : (
                        "Disable 2FA"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="passkeyModalText">
                    Step 1: Scan the QR code with Google Authenticator (or any TOTP app).
                  </p>
                  <div className="twoFaSetupGrid">
                    <div className="twoFaQrCard">
                      {twoFaQrSrc ? (
                        <img src={twoFaQrSrc} alt="2FA QR Code" className="twoFaQrImg" />
                      ) : twoFaLoading ? (
                        <div className="twoFaLoading">Generating QR…</div>
                      ) : (
                        <div className="twoFaLoading">QR not available</div>
                      )}
                    </div>
                    <div className="twoFaSecretCard">
                      <div className="twoFaSecretLabel">Secret key</div>
                      <div className="twoFaSecretKey">{twoFaSecret ? formatSecretKey(twoFaSecret) : "—"}</div>
                      <div className="twoFaSecretActions">
                        <button
                          type="button"
                          className="twoFaCopyBtn"
                          onClick={handleCopySecret}
                          disabled={!twoFaSecret || twoFaLoading}
                        >
                          Copy
                        </button>
                      </div>
                      <div className="twoFaHint">If QR doesn't work, manually enter the secret key.</div>
                    </div>
                  </div>

                  <p className="passkeyModalText" style={{ marginTop: "var(--space-lg)" }}>
                    Step 2: Enter the 6-digit code from your authenticator.
                  </p>

                  <div
                    className="twoFaOtpWrap"
                    onKeyDownCapture={(e) => {
                      // Stop Ctrl+V from reaching OTPInput's handler which calls e.preventDefault()
                      // and uses navigator.clipboard.readText() (fails on non-HTTPS).
                      // Without preventDefault, browser fires paste event naturally → onPaste below catches it.
                      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
                        e.stopPropagation();
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData?.getData('text') || '';
                      const digits = text.replace(/\D/g, '').slice(0, 6);
                      if (digits) {
                        e.preventDefault();
                        setTwoFaCode(digits);
                        if (twoFaError) setTwoFaError(null);
                        if (digits.length === 6) handleVerifySetup(digits);
                      }
                    }}
                  >
                    <OTPInput
                      value={twoFaCode}
                      onChange={(code) => {
                        setTwoFaCode(code);
                        if (twoFaError) setTwoFaError(null);
                      }}
                      onComplete={handleVerifySetup}
                      error={!!twoFaError}
                      disabled={twoFaLoading || twoFaVerifying || twoFaDisabling}
                    />
                    {twoFaError && (
                      <div className="passkeyMessage passkeyError" role="alert">
                        {twoFaError}
                      </div>
                    )}
                  </div>

                  <div className="passkeyModalActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closeTwoFaModal}
                      disabled={twoFaVerifying || twoFaLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="passkeyModalBtn primary"
                      onClick={() => handleVerifySetup(twoFaCode)}
                      disabled={twoFaLoading || twoFaVerifying || twoFaCode.length !== 6}
                    >
                      {twoFaVerifying ? (
                        <>
                          <span className="passkeySpinner" />
                          Verifying…
                        </>
                      ) : (
                        "Verify & Enable 2FA"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {changePwdOpen && (
        <div
          className="passkeyModalOverlay changePwdModalOverlay"
          onClick={(e) => e.target === e.currentTarget && closeChangePwdModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-pwd-modal-title"
        >
          <div className="passkeyModal changePwdModal" onClick={(e) => e.stopPropagation()}>
            <div className="passkeyModalHeader">
              <h2 id="change-pwd-modal-title" className="passkeyModalTitle">Change password</h2>
              <button
                type="button"
                className="passkeyModalClose"
                onClick={closeChangePwdModal}
                disabled={changePwdLoading}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="passkeyModalBody changePwdModalBody">
              {changePwdSuccess ? (
                <div className="passkeyMessage passkeySuccess">
                  <span>{changePwdSuccess}</span>
                  <button type="button" className="passkeyModalBtn primary" onClick={closeChangePwdModal}>
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePwdSubmit} className="changePwdForm">
                  {changePwdErrors.general && (
                    <div className="passkeyMessage passkeyError" role="alert">
                      {changePwdErrors.general}
                    </div>
                  )}
                  <div className="changePwdFormGroup">
                    <label className="changePwdLabel" htmlFor="change-pwd-current">
                      Current password
                    </label>
                    <div className="changePwdInputWrap">
                      <input
                        id="change-pwd-current"
                        type={showCurrentPwd ? "text" : "password"}
                        value={changePwdForm.current_password}
                        onChange={(e) => setChangePwdForm((p) => ({ ...p, current_password: e.target.value }))}
                        className={`changePwdInput ${changePwdErrors.current_password ? "error" : ""}`}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        disabled={changePwdLoading}
                      />
                      <button
                        type="button"
                        className="changePwdToggle"
                        onClick={() => setShowCurrentPwd((s) => !s)}
                        aria-label={showCurrentPwd ? "Hide password" : "Show password"}
                      >
                        {showCurrentPwd ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {changePwdErrors.current_password && <span className="changePwdError">{changePwdErrors.current_password}</span>}
                  </div>
                  <div className="changePwdFormGroup">
                    <label className="changePwdLabel" htmlFor="change-pwd-new">
                      New password
                    </label>
                    <div className="changePwdInputWrap">
                      <input
                        id="change-pwd-new"
                        type={showNewPwd ? "text" : "password"}
                        value={changePwdForm.new_password}
                        onChange={(e) => setChangePwdForm((p) => ({ ...p, new_password: e.target.value }))}
                        className={`changePwdInput ${changePwdErrors.new_password ? "error" : ""}`}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        disabled={changePwdLoading}
                      />
                      <button
                        type="button"
                        className="changePwdToggle"
                        onClick={() => setShowNewPwd((s) => !s)}
                        aria-label={showNewPwd ? "Hide password" : "Show password"}
                      >
                        {showNewPwd ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {changePwdErrors.new_password && <span className="changePwdError">{changePwdErrors.new_password}</span>}
                  </div>
                  <div className="changePwdFormGroup">
                    <label className="changePwdLabel" htmlFor="change-pwd-confirm">
                      Confirm new password
                    </label>
                    <div className="changePwdInputWrap">
                      <input
                        id="change-pwd-confirm"
                        type={showConfirmPwd ? "text" : "password"}
                        value={changePwdForm.confirm_password}
                        onChange={(e) => setChangePwdForm((p) => ({ ...p, confirm_password: e.target.value }))}
                        className={`changePwdInput ${changePwdErrors.confirm_password ? "error" : ""}`}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        disabled={changePwdLoading}
                      />
                      <button
                        type="button"
                        className="changePwdToggle"
                        onClick={() => setShowConfirmPwd((s) => !s)}
                        aria-label={showConfirmPwd ? "Hide password" : "Show password"}
                      >
                        {showConfirmPwd ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {changePwdErrors.confirm_password && <span className="changePwdError">{changePwdErrors.confirm_password}</span>}
                  </div>
                  <div className="passkeyModalActions changePwdActions">
                    <button
                      type="button"
                      className="passkeyModalBtn secondary"
                      onClick={closeChangePwdModal}
                      disabled={changePwdLoading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="passkeyModalBtn primary" disabled={changePwdLoading}>
                      {changePwdLoading ? (
                        <>
                          <span className="passkeySpinner" />
                          Changing…
                        </>
                      ) : (
                        "Change password"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritySettings;
