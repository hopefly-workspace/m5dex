import { useEffect } from 'react';
// import Header from '../components/landing/Header';
import HeroSection from '../components/landing/HeroSection';
import AppDownload from '../components/landing/AppDownload';
import ComplianceFooter from '../components/landing/ComplianceFooter';
import Header from '../components/Header';
import '../styles/landing/Landing.css';

const Landing = () => {

  useEffect(() => {
    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Import Google Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <div className="landing-page">
      {/* <Header /> */}
      <Header />
      <main className="landing-main">
        <HeroSection />
        <AppDownload />
      </main>
      <ComplianceFooter />
    </div>
  );
};

export default Landing;

