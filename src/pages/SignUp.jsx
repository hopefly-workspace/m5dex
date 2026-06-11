import Header from '../components/Header';
import SignUpForm from '../components/SignUp';
// import Header from '../components/landing/Header';
import '../styles/pages/AuthPremium.css';

const SignUp = () => {
  return (
    <div className="ark-auth-page ark_bg">
      <div className="premium-bg-effect"></div>
      {/* <Header /> */}
      <div className="ark-auth-container ark-auth-container-centered">
        {/* Centered Signup Form */}
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card register_card">
            <SignUpForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;

