import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import FloatingCoin from './FloatingCoin';
import PhoneMockup from './PhoneMockup';
import '../../styles/landing/HeroSection.css';

const HeroSection = () => {
  const navigate = useNavigate();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const leftVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  const rightVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  return (
    <section className="hero-section">
      <motion.div
        className="hero-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="hero-left" variants={leftVariants}>
          <div className="hero-badge">
            <span className="badge-flag">🇮🇳</span>
            <span className="badge-text">Made for INDIA</span>
          </div>

          <h1 className="hero-heading">
            Trade Futures & Options on Bitcoin and Ether
          </h1>

          <p className="hero-subheading">
            Elevate your crypto F&O trading with 24/7 open markets, efficient margining and INR settlement
          </p>

          <motion.button
            className="hero-cta"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </motion.button>
        </motion.div>

        <motion.div className="hero-right" variants={rightVariants}>
          <FloatingCoin
            type="bitcoin"
            position={{ top: '10%', left: '-5%' }}
          />
          <PhoneMockup />
          <FloatingCoin
            type="ethereum"
            position={{ top: '15%', right: '-5%' }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;

