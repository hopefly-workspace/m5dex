import { motion } from 'framer-motion';
import { Play, Apple, Download } from 'lucide-react';
import '../../styles/landing/AppDownload.css';

const AppDownload = () => {
  const apps = [
    { name: 'Google Play', icon: Play, color: '#00C896' },
    { name: 'App Store', icon: Apple, color: '#FFFFFF' },
    { name: 'Android APK', icon: Download, color: '#3DDC84' },
  ];

  return (
    <section className="app-download-section">
      <div className="app-download-container">
        <h2 className="app-download-title">Trade On the Go!</h2>
        <div className="app-icons">
          {apps.map((app, index) => (
            <motion.div
              key={index}
              className="app-icon-wrapper"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="app-icon" style={{ color: app.color }}>
                <app.icon size={48} />
              </div>
              <span className="app-name">{app.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AppDownload;

