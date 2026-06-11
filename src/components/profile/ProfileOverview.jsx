import { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { copyToClipboard } from '../../utils/clipboard';
import '../../styles/components/profile/ProfileOverview.css';

import {
  Mail,
  Fingerprint,
  Clock,
  History,
  Copy,
  BriefcaseBusiness,
  AlarmClock
} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { getDeviceInfo } from '../../utils/clientDeviceInfo';


const ProfileOverview = ({ user }) => {
  const { refreshProfile, updateUser } = useUser();
  const { showSuccess, showError } = useToast();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [nicknameError, setNicknameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showTotalValueDropdown, setShowTotalValueDropdown] = useState(false);
  const [showUSDropdown, setShowUSDropdown] = useState(false);
  const navigate = useNavigate();

  const profileURL = import.meta.env.VITE_IMAGE_URL || ""

  const userData = {
    name: user?.full_name || 'User',
    nickname: nickname || user?.full_name || 'Edit Profile',
    email: user?.email || 'ka***2@gmail.com',
    uid: user?.id || '51723564',
    isVerified: user?.email_verified || false,
    signUpTime: user?.created_at || '2025-10-28 18:57:56',
    lastLogin: user?.last_login_at || user?.last_login || '2025-12-22 18:29:38',
    lastLoginIP: user?.last_login_ip || '110.227.210.237',
    totalValueUSDT: '0 USDT',
    totalValueUSD: '≈ 0.00USD',
  };

  const hotEvents = [];

  const referralData = useMemo(() => {
    const uid = user?.id;
    if (!uid) {
      return {
        inviteLink: '',
        inviteCode: '',
        displayLink: 'Loading...',
      };
    }

    const currentDomain = window.location.origin;
    const referralCode = uid.toString();
    const inviteLink = `${currentDomain}/signup?ref=${referralCode}`;

    const domainParts = currentDomain.replace(/^https?:\/\//, '').split('.');
    const displayDomain = domainParts.length > 2
      ? `${domainParts[0].substring(0, 3)}...${domainParts.slice(-2).join('.')}`
      : currentDomain.replace(/^https?:\/\//, '').substring(0, 10) + '...';
    const displayLink = `${displayDomain}/signup?ref=${referralCode}`;

    return {
      inviteLink,
      inviteCode: referralCode,
      displayLink,
    };
  }, [user?.id]);

  const getUserInitials = () => {
    if (user?.full_name) {
      const names = user.full_name.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  useEffect(() => {
    if (showNicknameModal && user) {
      setNickname(user?.full_name || user?.nickname || '');
      setAvatarFile(null);
      setAvatarPreview(null);
      setNicknameError('');
      setSuccessMessage('');
    }
  }, [showNicknameModal, user]);

  const validateNickname = (value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'Nickname is required';
    }

    if (trimmed.length < 2) {
      return 'Nickname must be at least 2 characters';
    }

    if (trimmed.length > 30) {
      return 'Nickname must be less than 30 characters';
    }

    const validPattern = /^[a-zA-Z0-9\s._-]+$/;
    if (!validPattern.test(trimmed)) {
      return 'Nickname can only contain letters, numbers, spaces, and . _ -';
    }

    if (/\s{2,}/.test(trimmed)) {
      return 'Nickname cannot have consecutive spaces';
    }

    return '';
  };

  const handleSetNickname = () => {
    setShowNicknameModal(true);
  };

  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setNickname(value);

    if (value.trim()) {
      const error = validateNickname(value);
      setNicknameError(error);
    } else {
      setNicknameError('');
    }

    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setNicknameError('Please select an image file (JPEG, PNG, etc.)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setNicknameError('Image must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setNicknameError('');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    setRemoveAvatar(true);

    updateUser({
      ...user,
      avatar_url: "",
    });
  };
  const handleNicknameSubmit = async (e) => {
    e.preventDefault();

    const trimmedNickname = nickname.trim();
    const error = validateNickname(trimmedNickname);

    if (error) {
      setNicknameError(error);
      return;
    }

    const currentNickname = user?.full_name || user?.nickname || '';
    const hasNameChange = trimmedNickname !== currentNickname;
    const hasAvatarChange = !!avatarFile || removeAvatar;

    if (!hasNameChange && !hasAvatarChange) {
      setShowNicknameModal(false);
      setNickname('');
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }

    setIsSubmitting(true);
    setNicknameError('');
    setSuccessMessage('');

    try {

      const deviceInfo = await getDeviceInfo();

      const formData = new FormData();
      formData.append('full_name', trimmedNickname);

      formData.append(
        'device_info',
        JSON.stringify(deviceInfo)
      );

      if (avatarFile) {
        formData.append('avatar_url', avatarFile);
      }
      if (removeAvatar) {
        formData.append('avatar_url', '');
      }

      const response = await api.put('/users/profile', formData);

      if (response?.user || response?.data || response?.status) {
        const updated = response.user || response.data || response || {};
        const newAvatarUrl = updated.avatar_url ?? updated.avatar ?? updated.profile_picture ?? updated.photo;
        updateUser({
          full_name: hasNameChange ? trimmedNickname : user?.full_name,
          avatar_url: newAvatarUrl ?? user?.avatar_url,
        });
        await refreshProfile();
      }

      setSuccessMessage('Profile updated successfully!');

      setTimeout(() => {
        setShowNicknameModal(false);
        setNickname('');
        setAvatarFile(null);
        setAvatarPreview(null);
        setNicknameError('');
        setSuccessMessage('');
        showSuccess('Profile updated successfully!');
      }, 1500);
    } catch (error) {
      const errorMessage = error?.message || error?.data?.message || 'Failed to update profile. Please try again.';
      setNicknameError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setShowNicknameModal(false);
      setNickname('');
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setNicknameError('');
      setSuccessMessage('');
    }
  };

  const handleCopyReferral = async () => {
    try {
      await copyToClipboard(referralData.inviteLink);
      setCopied(true);
      showSuccess('Copied!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      showError('Copy failed. Please select and copy manually.');
    }
  };

  const handleCopyUID = async () => {
    try {
      await copyToClipboard(userData.uid);
      setCopied(true);
      showSuccess('Copied!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      showError('Copy failed. Please select and copy manually.');
    }
  };

  const handleBack = () => {
    navigate(-1);
    // navigate('/dashboard');
  };

  return (
    <div className="mexcProfileOverview">
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
      <div className="profileHeading">
        <h1 className="mexcOverviewHeader" >Profile & Settings</h1>
        <p className="mexcOverviewDescription">View and manage your personal information</p>
      </div>

      <div className="mexcTopSection">
        <div className="mexcUserHeader">
          <div className="mexcAvatarSection">
            <div className="mexcAvatarContainer">
              <div className="mexcAvatar">
                {user?.avatar_url && user.avatar_url !== "null" && user.avatar_url !== "" ? (
                  <img
                    // src={user.avatar_url}
                    src={profileURL + user.avatar_url}
                    alt={userData?.name?.charAt(0) || "U"}
                    className="mexcAvatarImage"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="mexcAvatarInitials">
                    {getUserInitials()}
                  </span>
                )}
                {/* {user?.avatar_url ? (
                  <img
                    src={profileURL + user.avatar_url}
                    alt={userData.name}
                    className="mexcAvatarImage"
                  />
                ) : (
                  <span className="mexcAvatarInitials">{getUserInitials()}</span>
                )} */}
              </div>
            </div>
            <div className="mexcNicknameSection">
              <button
                className="mexcSetNicknameBtn"
                onClick={handleSetNickname}
              >
                <span className="mexcSetNicknameText">{userData.nickname}</span>
                <span className="mexcSetNicknameIcon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
          {/* <span className={`mexcVerifiedBadge ${userData.isVerified ? 'verified' : 'unverified'}`}>
            {userData.isVerified ? 'Verified' : 'Unverified'}
          </span> */}
        </div>

        <p className='mexUserDetailLabel'>Contact Information</p>
        <div className="mexcUserDetails">
          <div className="mexcDetailsColumn">
            <div className="mexcInfoRow">
              <div className="mexcInfoIcon">
                <Mail size={18} />
              </div>
              <div className="mexcInfoText">
                <p className="mexcInfoLabel">Account</p>
                <div className='mexInfo'>
                  <span className="mexcInfoValue">{userData.email}</span>
                </div>
              </div>
            </div>

            <div className="mexcInfoRow">
              <div className="mexcInfoIcon">
                <BriefcaseBusiness size={18} />
              </div>
              <div className="mexcInfoText">
                <span className="mexcInfoLabel">UID</span>
                <div className="mexUID">
                  <span className="mexcInfoValue">{userData.uid}</span>
                  <button className="mexcCopyIconBtn" onClick={handleCopyUID}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="mexcDetailsColumn">
            <div className="mexcInfoRow">
              <div className="mexcInfoIcon">
                <AlarmClock size={18} />
              </div>
              <div className="mexcInfoText">
                <span className="mexcInfoLabel">Sign-up Time</span>
                <span className="mexcInfoValue">{userData.signUpTime}</span>
              </div>
            </div>

            <div className="mexcInfoRow">
              <div className="mexcInfoIcon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={18}
                  height={18}
                  viewBox="0 0 18 18"
                  fill="none"
                >
                  <path
                    d="M8.56694 4.55806C8.81102 4.80214 8.81102 5.19786 8.56694 5.44194L6.50888 7.5H10C11.3807 7.5 12.5 8.61929 12.5 10V12.5C12.5 12.8452 12.2202 13.125 11.875 13.125C11.5298 13.125 11.25 12.8452 11.25 12.5V10C11.25 9.30964 10.6904 8.75 10 8.75H6.50888L8.56694 10.8081C8.81102 11.0521 8.81102 11.4479 8.56694 11.6919C8.32286 11.936 7.92714 11.936 7.68306 11.6919L4.55806 8.56694C4.31398 8.32286 4.31398 7.92714 4.55806 7.68306L7.68306 4.55806C7.92714 4.31398 8.32286 4.31398 8.56694 4.55806Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9.375 0C13.8623 0 17.5 3.63769 17.5 8.125V9.375C17.5 13.8623 13.8623 17.5 9.375 17.5H8.125C3.63769 17.5 0 13.8623 0 9.375V8.125C0 3.63769 3.63769 0 8.125 0H9.375ZM8.125 1.25H9.375C13.172 1.25 16.25 4.32804 16.25 8.125V9.375C16.25 13.172 13.172 16.25 9.375 16.25H8.125C4.32804 16.25 1.25 13.172 1.25 9.375V8.125C1.25 4.32804 4.32804 1.25 8.125 1.25Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="mexcInfoText">
                <span className="mexcInfoLabel">Last Login</span>
                <span className="mexcInfoValue">
                  {userData.lastLogin} ({userData.lastLoginIP})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="mexcUserDetails">
          <div className="mexcAccountRow">
            <div
              className="mexcAccountDropdown"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            >
              <span className="mexcAccountLabel">Account</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <span className="mexcAccountEmail">{userData.email}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcEditIconDisabled">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>

          <div className="mexcUIDRow">
            <span className="mexcUIDLabel">UID</span>
            <span className="mexcUIDValue">{userData.uid}</span>
            <button className="mexcCopyIconBtn" onClick={handleCopyUID}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <div className="mexcSignUpRow">
            <span className="mexcSignUpLabel">Sign-up Time</span>
            <span className="mexcSignUpValue">{userData.signUpTime}</span>
          </div>

          <div className="mexcLastLoginRow">
            <span className="mexcLastLoginLabel">Last Login</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcArrowIcon">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className="mexcLastLoginValue">{userData.lastLogin} ({userData.lastLoginIP})</span>
          </div>
        </div> */}
      </div>

      {/* <div className="mexcTopSection">
        <div className="mexcUserHeader">
          <div className="mexcAvatarSection">
            <div className="mexcAvatarContainer">
              <div className="mexcAvatar">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={userData.name}
                    className="mexcAvatarImage"
                  />
                ) : (
                  <span className="mexcAvatarInitials">{getUserInitials()}</span>
                )}
              </div>
            </div>
            <div className="mexcNicknameSection">
              <button
                className="mexcSetNicknameBtn"
                onClick={handleSetNickname}
              >
                {userData.nickname}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <span className={`mexcVerifiedBadge ${userData.isVerified ? 'verified' : 'unverified'}`}>
                {userData.isVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
        </div>

        <div className="mexcUserDetails">
          <div className="mexcAccountRow">
            <div
              className="mexcAccountDropdown"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            >
              <span className="mexcAccountLabel">Account</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <span className="mexcAccountEmail">{userData.email}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcEditIconDisabled">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>

          <div className="mexcUIDRow">
            <span className="mexcUIDLabel">UID</span>
            <span className="mexcUIDValue">{userData.uid}</span>
            <button className="mexcCopyIconBtn" onClick={handleCopyUID}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <div className="mexcSignUpRow">
            <span className="mexcSignUpLabel">Sign-up Time</span>
            <span className="mexcSignUpValue">{userData.signUpTime}</span>
          </div>

          <div className="mexcLastLoginRow">
            <span className="mexcLastLoginLabel">Last Login</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcArrowIcon">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <span className="mexcLastLoginValue">{userData.lastLogin} ({userData.lastLoginIP})</span>
          </div>
        </div>
      </div> */}
      {/* Main Content - Two Column Layout */}
      <div className="mexcMainContent">
        <div className="mexcLeftColumn">
          {/* <div className="mexcTotalValueCard">
            <div className="mexcTotalValueHeader">
              <h3 className="mexcTotalValueTitle">Total Value</h3>
              <button className="mexcEyeIconBtn">
                <a href="#asset-details" className="mexcAssetDetailsLink">Asset Details</a>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <div className="mexcTotalValueContent">
              <div className="mexcValueContent">
                <div
                  className="mexcValueRow"
                  onClick={() => setShowTotalValueDropdown(!showTotalValueDropdown)}
                >
                  <span className="mexcValueMain">{userData.totalValueUSDT}</span>
                  <svg className="svgclass" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>

              <div className="mexcValueContent">
                <div
                  className="mexcValueRow"
                  onClick={() => setShowUSDropdown(!showUSDropdown)}
                >
                  <span className="mexcValueSub">{userData.totalValueUSD}</span>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
              <button className="mexcDepositBtn">Deposit</button>
            </div>
          </div> */}
          <div className="mexcReferralCard">
            <div className="mexcReferralHeader">
              <h3 className="mexcReferralTitle">Referral</h3>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcArrowIcon">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mexcReferralSubtitle">Invite friends for more commissions</p>
            <div className="mexcReferralLink">
              <input
                type="text"
                className="mexcReferralInput"
                value={referralData.displayLink}
                readOnly
              />
              <button className="mexcCopyIconBtn" onClick={handleCopyReferral} title="Copy link">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mexcLearnCard">
            <div className="mexcLearnHeader">
              {/* <div className="mexcLearnIcon">🎓</div> */}
              <h3 className="mexcLearnTitle">Learn</h3>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mexcArrowIcon">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <p className="mexcLearnSubtitle">Learn All About Crypto. All Questions, Answered.</p>
          </div>

        </div>

        <div className="mexcRightColumn">
          <div className="mexcHotEventCard">
            <div className="mexcHotEventsSection">
              <h3 className="mexcHotEventsTitle">Hot Events</h3>
              <div className="mexcHotEventsList">
                {
                  hotEvents.length === 0 && (
                    <p className="mexcNoEventsMessage">No hot events at the moment.</p>
                  )
                }
                {hotEvents.map((event) => (
                  <div key={event.id} className="mexcEventCard">
                    <div className="mexcEventLogo" style={{ backgroundColor: event.logoColor + '20' }}>
                      {event.icon === 'ETH' ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill={event.logoColor}>
                          <path d="M11.944 0L12 0V2.777L11.944 2.8V0ZM11.944 21.2L12 21.223V24L11.944 24V21.2ZM23.888 12L24 12.056V11.944L23.888 12ZM0.112 12L0 11.944V12.056L0.112 12ZM21.612 16.5L21.5 16.556V16.444L21.612 16.5ZM2.388 7.5L2.5 7.444V7.556L2.388 7.5ZM21.612 7.5L21.5 7.556V7.444L21.612 7.5ZM2.388 16.5L2.5 16.556V16.444L2.388 16.5ZM18.224 19.5L18.112 19.556V19.444L18.224 19.5ZM5.776 4.5L5.888 4.444V4.556L5.776 4.5ZM18.224 4.5L18.112 4.556V4.444L18.224 4.5ZM5.776 19.5L5.888 19.556V19.444L5.776 19.5ZM12 2.777L21.612 7.5L20.388 10.5L12 7.223V2.777ZM21.612 7.5L23.888 12L21.612 16.5L12 21.223V16.777L20.388 13.5L21.612 16.5ZM23.888 12L21.612 7.5L20.388 10.5L21.612 13.5L23.888 12ZM21.612 16.5L12 21.223V16.777L20.388 13.5L21.612 16.5ZM12 21.223L2.388 16.5L3.612 13.5L12 16.777V21.223ZM2.388 16.5L0.112 12L2.388 7.5L12 2.777V7.223L3.612 10.5L2.388 7.5ZM0.112 12L2.388 16.5L3.612 13.5L2.388 10.5L0.112 12ZM2.388 7.5L12 2.777V7.223L3.612 10.5L2.388 7.5ZM12 7.223L20.388 10.5L12 13.777V7.223ZM12 13.777L3.612 10.5L12 7.223V13.777Z" />
                        </svg>
                      ) : (
                        <span className="mexcEventIcon">{event.icon}</span>
                      )}
                    </div>
                    <div className="mexcEventContent">
                      <h4 className="mexcEventTitle">{event.title}</h4>
                      <span className="mexcEventStatus">{event.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <button className="mexcSupportIcon" title="Support">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
        </svg>
      </button> */}

      {showNicknameModal && (
        <div className="profileEditModalOverlay" onClick={handleCloseModal}>
          <div className="profileEditModal" onClick={(e) => e.stopPropagation()}>
            <div className="profileEditModalHeader">
              <h3 className="profileEditModalTitle">Edit Profile</h3>
              <button
                type="button"
                className="profileEditModalClose"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="profileEditModalForm" onSubmit={handleNicknameSubmit}>
              <div className="profileEditModalAvatarWrap">
                <label className="profileEditModalAvatarLabel">
                  <div className="profileEditModalAvatarPreview">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="profileEditModalAvatarImg" />
                    ) : user?.avatar_url && user.avatar_url !== "null" && user.avatar_url !== "" ? (
                      <img
                        src={profileURL + user.avatar_url}
                        alt={userData?.name || "User avatar"}
                        className="profileEditModalAvatarImg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="profileEditModalAvatarInitials">{getUserInitials()}</span>
                    )}
                    <div className="profileEditModalAvatarOverlay">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Change photo</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="profileEditModalAvatarInput"
                    onChange={handleAvatarChange}
                    disabled={isSubmitting}
                  />
                  {(avatarPreview || user?.avatar_url && user.avatar_url !== "null" && user.avatar_url !== "") && (
                    <button
                      type="button"
                      className="profileEditModalRemoveIcon"
                      onClick={handleRemoveAvatar}
                    >
                      ✕
                    </button>
                  )}
                </label>
              </div>

              <div className="profileEditModalField">
                <label className="profileEditModalLabel">Display name</label>
                <input
                  type="text"
                  className={`profileEditModalInput ${nicknameError ? 'error' : ''} ${successMessage ? 'success' : ''}`}
                  placeholder="Enter your name"
                  value={nickname}
                  onChange={handleNicknameChange}
                  maxLength={30}
                  autoFocus
                  disabled={isSubmitting}
                />
                <div className="profileEditModalFieldMeta">
                  {nicknameError && (
                    <span className="profileEditModalError">{nicknameError}</span>
                  )}
                  {successMessage && (
                    <div className="profileEditModalSuccess">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      {successMessage}
                    </div>
                  )}
                  <span className="profileEditModalCharCount">{nickname.length}/30</span>
                </div>
              </div>

              <div className="profileEditModalActions">
                <button
                  type="button"
                  className="profileEditModalBtn profileEditModalBtnCancel"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="profileEditModalBtn profileEditModalBtnSave"
                  disabled={isSubmitting || !!nicknameError || !nickname.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <span className="profileEditModalSpinner" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileOverview;

