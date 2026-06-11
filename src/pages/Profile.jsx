import { useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileSidebar from '../components/profile/ProfileSidebar';
import ProfileOverview from '../components/profile/ProfileOverview';
import KYCVerification from '../components/profile/KYCVerification';
import SecuritySettings from '../components/profile/SecuritySettings';
import ConnectedExchanges from '../components/profile/ConnectedExchanges';
import Notifications from '../components/profile/Notifications';
import '../styles/pages/Profile.css';

const Profile = () => {
  const location = useLocation();
  const { user, isLoading, error, refreshProfile } = useUser();
  const isVerificationPage = location.pathname === '/profile/verification';
  const isSecurityPage = location.pathname === '/profile/security';
  const isExchangesPage = location.pathname === '/profile/exchanges';
  const isNotificationsPage = location.pathname === '/profile/notifications';

  const breadcrumbs = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Profile & Settings', path: '/profile' },
    ...(isVerificationPage ? [{ label: 'Identity Verification', path: '/profile/verification' }] : []),
    ...(isSecurityPage ? [{ label: 'Security Settings', path: '/profile/security' }] : []),
    ...(isExchangesPage ? [{ label: 'Connected Exchanges', path: '/profile/exchanges' }] : []),
    ...(isNotificationsPage ? [{ label: 'Notifications', path: '/profile/notifications' }] : []),
  ];

  const handleSupportClick = () => {
  };

  const renderContent = () => {
    if (isLoading && !isNotificationsPage) return <div>Loading profile...</div>;
    if (error && !isNotificationsPage) return <div>Error loading profile: {error}</div>;

    if (isVerificationPage) {
      return <KYCVerification />;
    }
    if (isSecurityPage) {
      return <SecuritySettings />;
    }
    if (isExchangesPage) {
      return <ConnectedExchanges />;
    }
    if (isNotificationsPage) {
      return <Notifications />;
    }
    return <ProfileOverview user={user} />;
  };

  return (
    <div className="profilePage">
      <ProfileHeader
        breadcrumbs={breadcrumbs}
        onSupportClick={handleSupportClick}
      />

      <div className="profileLayout">
        <ProfileSidebar />
        <div className="profileContent">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Profile;

