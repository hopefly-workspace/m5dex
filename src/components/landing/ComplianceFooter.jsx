import { IndianRupee } from 'lucide-react';
import '../../styles/landing/ComplianceFooter.css';

const ComplianceFooter = () => {
  return (
    <footer className="compliance-footer">
      <div className="compliance-container">
        <div className="compliance-icon">
          <IndianRupee size={32} />
        </div>
        <p className="compliance-text">
          We are registered with FIU - Govt of India and are fully compliant with Indian regulations
        </p>
      </div>
    </footer>
  );
};

export default ComplianceFooter;

