import { motion } from 'framer-motion';
import { Bitcoin, Coins } from 'lucide-react';
import '../../styles/landing/FloatingCoin.css';

const FloatingCoin = ({ type = 'bitcoin', position = { top: '20%', left: '10%' } }) => {
  const isBitcoin = type === 'bitcoin';
  
  const floatAnimation = {
    y: [0, -20, 0],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  };

  const style = {
    top: position.top,
    left: position.left,
    right: position.right,
    bottom: position.bottom,
  };

  return (
    <motion.div
      className={`floating-coin ${isBitcoin ? 'bitcoin' : 'ethereum'}`}
      style={style}
      animate={floatAnimation}
    >
      <div className="coin-glow"></div>
      <div className="coin-icon">
        {isBitcoin ? (
          <Bitcoin size={80} className="coin-svg" />
        ) : (
          <Coins size={80} className="coin-svg" />
        )}
      </div>
    </motion.div>
  );
};

export default FloatingCoin;

