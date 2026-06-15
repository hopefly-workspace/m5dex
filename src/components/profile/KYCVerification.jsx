import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { tokenStorage } from '../../utils/storage';
import { validatePhone } from '../../utils/validators';
import { formatTimer } from '../../utils/formatTime';
import OTPInput from '../OTPInput';
import CountryCodeSelector from '../CountryCodeSelector';
import CustomSelect from '../CustomSelect';
import '../../styles/components/profile/KYCVerification.css';

const KYCVerification = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showInfo } = useToast();
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [kycData, setKycData] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [level1Data, setLevel1Data] = useState({
    email: '',
    phone: '',
    emailVerified: false,
    phoneVerified: false,
  });

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [modalPhoneNumber, setModalPhoneNumber] = useState('');
  const [modalCountryCode, setModalCountryCode] = useState('+91');
  const [modalPhoneOTP, setModalPhoneOTP] = useState('');
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [canResendPhone, setCanResendPhone] = useState(false);
  const [isSendingPhoneOTP, setIsSendingPhoneOTP] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verificationData, setVerificationData] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: { day: '', month: '', year: '' },
    nationality: 'United States',
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
    },
    documentType: 'national-id',
    documentFront: null,
    documentBack: null,
    selfie: null,
    addressProof: null,
  });

  useEffect(() => {
    fetchKYCStatus();
    if (user) {
      const userPhone = user.phone || user.phone_number || '';

      setLevel1Data(prev => ({
        ...prev,
        email: user.email || '',
        phone: userPhone,
        emailVerified: user.email_verified || false,
        phoneVerified: user.phone_verified || false,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (phoneTimer > 0) {
      const interval = setInterval(() => {
        setPhoneTimer(prev => {
          if (prev <= 1) {
            setCanResendPhone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phoneTimer]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showPhoneModal) {
        handleClosePhoneModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPhoneModal]);

  useEffect(() => {
    if (showPhoneModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPhoneModal]);

  const fetchKYCStatus = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/profile/kyc/status');
      const kycStatus = response?.kyc_status || response?.data?.kyc_status || 'pending';
      const kycLevel = response?.level || response?.data?.level || 1;
      const submittedAt = response?.submitted_at || response?.data?.submitted_at;
      const verifiedAt = response?.verified_at || response?.data?.verified_at;
      const rejectionReason = response?.rejection_reason || response?.data?.rejection_reason;

      setKycData({
        kyc_status: kycStatus,
        level: kycLevel,
        submitted_at: submittedAt,
        verified_at: verifiedAt,
        rejection_reason: rejectionReason,
      });

      if (kycStatus === 'verified') {
        setVerificationStatus('completed');
      } else if (kycStatus === 'pending' && submittedAt) {
        setVerificationStatus('under-review');
      } else if (kycStatus === 'rejected') {
        setVerificationStatus('rejected');
      } else {
        setVerificationStatus('in-progress');
      }

      if (kycLevel >= 2) {
        setCurrentLevel(2);
        setCurrentStep(1);
      } else if (kycLevel === 1 && kycStatus === 'verified') {
        setCurrentLevel(2);
        setCurrentStep(1);
      } else {
        setCurrentLevel(1);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      showError('Failed to load KYC status. Please try again.');
      setKycData({
        kyc_status: 'pending',
        level: 1,
        submitted_at: null,
        verified_at: null,
        rejection_reason: null,
      });
      setVerificationStatus('in-progress');
    } finally {
      setIsLoading(false);
    }
  };

  const verificationLevels = [
    {
      level: 1,
      name: 'Basic',
      status: kycData?.level >= 1 && kycData?.kyc_status === 'verified' ? 'completed' :
        (kycData?.level === 0 || !kycData?.level) ? 'available' : 'in-progress',
      benefits: [
        'Daily withdrawal: $50,000',
        'Spot trading enabled',
        'Basic support access',
      ],
    },
    {
      level: 2,
      name: 'Advanced',
      status: kycData?.level >= 2 && kycData?.kyc_status === 'verified' ? 'completed' :
        (kycData?.level >= 1 && kycData?.kyc_status === 'verified') ? 'available' : 'locked',
      benefits: [
        'Daily withdrawal: $500,000',
        'Futures trading enabled',
        'Priority support',
        'Lower trading fees',
      ],
    },
  ];

  const level1Steps = [
    { id: 1, title: 'Phone Verification', completed: level1Data.phoneVerified },
  ];

  const level2Steps = [
    { id: 1, title: 'Personal Information', completed: true },
    { id: 2, title: 'Document Upload', completed: false },
    { id: 3, title: 'Selfie Verification', completed: false },
    { id: 4, title: 'Address Verification', completed: false },
  ];

  const steps = currentLevel === 1 ? level1Steps : level2Steps;

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }

    setTouched(prev => ({
      ...prev,
      [field]: true,
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleDateChange = (part, value) => {
    setFormData(prev => ({
      ...prev,
      dateOfBirth: {
        ...prev.dateOfBirth,
        [part]: value,
      },
    }));

    setTouched(prev => ({
      ...prev,
      [`dateOfBirth.${part}`]: true,
    }));

    if (errors.dateOfBirth) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.dateOfBirth;
        return newErrors;
      });
    }
  };

  const handleFileUpload = (field, file) => {
    setFormData(prev => ({
      ...prev,
      [field]: file,
    }));

    setTouched(prev => ({
      ...prev,
      [field]: true,
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.fullName || formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    } else if (formData.fullName.trim().length > 100) {
      newErrors.fullName = 'Full name cannot exceed 100 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.fullName.trim())) {
      newErrors.fullName = 'Full name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (!formData.dateOfBirth.year || !formData.dateOfBirth.month || !formData.dateOfBirth.day) {
      newErrors.dateOfBirth = 'Please select complete date of birth';
    } else {
      const year = parseInt(formData.dateOfBirth.year);
      const month = parseInt(formData.dateOfBirth.month);
      const day = parseInt(formData.dateOfBirth.day);
      const currentYear = new Date().getFullYear();
      const minYear = currentYear - 120;
      const maxYear = currentYear - 18;

      if (year < minYear || year > maxYear) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      } else {
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          newErrors.dateOfBirth = 'Invalid date';
        }
      }
    }

    if (!formData.nationality || formData.nationality.trim() === '') {
      newErrors.nationality = 'Please select nationality';
    }

    if (!formData.address.street || formData.address.street.trim().length < 5) {
      newErrors['address.street'] = 'Street address must be at least 5 characters';
    }

    if (!formData.address.city || formData.address.city.trim().length < 2) {
      newErrors['address.city'] = 'City name must be at least 2 characters';
    }

    if (!formData.address.state || formData.address.state.trim().length < 2) {
      newErrors['address.state'] = 'State/Province must be at least 2 characters';
    }

    if (!formData.address.zipCode || formData.address.zipCode.trim().length < 3) {
      newErrors['address.zipCode'] = 'ZIP/Postal code must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9\s-]+$/.test(formData.address.zipCode.trim())) {
      newErrors['address.zipCode'] = 'Invalid ZIP/Postal code format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.documentType) {
      newErrors.documentType = 'Please select a document type';
    }

    if (!formData.documentFront) {
      newErrors.documentFront = 'Please upload document front image';
    } else {
      // File size validation (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (formData.documentFront.size > maxSize) {
        newErrors.documentFront = 'File size must be less than 10MB';
      }
      if (!formData.documentFront.type.startsWith('image/')) {
        newErrors.documentFront = 'Please upload an image file';
      }
    }

    if (formData.documentType === 'national-id' || formData.documentType === 'drivers-license') {
      if (!formData.documentBack) {
        newErrors.documentBack = 'Please upload document back image';
      } else {
        const maxSize = 10 * 1024 * 1024;
        if (formData.documentBack.size > maxSize) {
          newErrors.documentBack = 'File size must be less than 10MB';
        }
        if (!formData.documentBack.type.startsWith('image/')) {
          newErrors.documentBack = 'Please upload an image file';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};

    if (!formData.selfie) {
      newErrors.selfie = 'Please upload or capture a selfie with your document';
    } else {
      const maxSize = 10 * 1024 * 1024;
      if (formData.selfie.size > maxSize) {
        newErrors.selfie = 'File size must be less than 10MB';
      }
      if (!formData.selfie.type.startsWith('image/')) {
        newErrors.selfie = 'Please upload an image file';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    const newErrors = {};

    if (!formData.addressProof) {
      newErrors.addressProof = 'Please upload proof of address document';
    } else {
      const maxSize = 10 * 1024 * 1024;
      if (formData.addressProof.size > maxSize) {
        newErrors.addressProof = 'File size must be less than 10MB';
      }
      const allowedTypes = ['application/pdf', 'image/'];
      const isValidType = allowedTypes.some(type => formData.addressProof.type.startsWith(type));
      if (!isValidType) {
        newErrors.addressProof = 'Please upload PDF or image file';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Level 1: Send Email OTP
  const handleSendEmailOTP = async () => {
    if (!level1Data.email) {
      showError('Email address is required');
      return;
    }

    setIsSendingEmailOTP(true);
    try {
      const response = await api.post('/auth/send-otp', {
        verification_type: 'email',
        email: level1Data.email,
      });

      if (response.success || response.message) {
        showSuccess('OTP sent to your email address');
        setEmailTimer(60);
        setCanResendEmail(false);
      }
    } catch (error) {
      showError(error?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingEmailOTP(false);
    }
  };

  const handleOpenPhoneModal = async () => {
    setShowPhoneModal(true);
    setModalPhoneOTP('');
    setPhoneTimer(0);
    setCanResendPhone(false);
    setErrors({});

    const userPhone = user?.phone || user?.phone_number || level1Data?.phone || '';

    if (userPhone) {
      const phoneMatch = userPhone.match(/^(\+\d{1,4})(\d+)$/);
      if (phoneMatch) {
        const [, countryCode, phoneNumber] = phoneMatch;
        setModalCountryCode(countryCode);
        setModalPhoneNumber(phoneNumber.replace(/\D/g, ''));
        await handleAutoSendOTP(countryCode, phoneNumber.replace(/\D/g, ''));
      } else {
        const cleanedPhone = userPhone.replace(/\D/g, '');
        if (cleanedPhone.length >= 10) {
          let detectedCode = '+91';
          let phoneNum = cleanedPhone;
          if (cleanedPhone.startsWith('91') && cleanedPhone.length > 10) {
            detectedCode = '+91';
            phoneNum = cleanedPhone.substring(2);
          } else if (cleanedPhone.startsWith('1') && cleanedPhone.length === 11) {
            detectedCode = '+1';
            phoneNum = cleanedPhone.substring(1);
          }
          setModalCountryCode(detectedCode);
          setModalPhoneNumber(phoneNum);
          await handleAutoSendOTP(detectedCode, phoneNum);
        }
      }
    }
  };

  const handleAutoSendOTP = async (countryCode, phoneNumber) => {
    if (!phoneNumber) {
      showError('Invalid phone number. Please contact support.');
      handleClosePhoneModal();
      return;
    }

    setIsSendingPhoneOTP(true);
    setErrors(prev => ({ ...prev, modalOTP: null }));

    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const response = await api.post('/users/sendphoneotp', {
        phoneno: phoneNumber,
      }, {
        headers: {
          Authorization: `Bearer ${tokenStorage.getToken()}`
        }
      });

      if (response.temp_token) {
        setVerificationData(prev => ({
          ...prev,
          temp_token: response.temp_token,
        }));
      }

      if (response.success || response.message) {
        showSuccess('OTP sent to your phone number');
        setPhoneTimer(60);
        setCanResendPhone(false);
        setLevel1Data(prev => ({
          ...prev,
          phone: fullPhone,
        }));
      }
    } catch (error) {
      showError(error?.message || 'Failed to send OTP. Please try again.');
      handleClosePhoneModal();
    } finally {
      setIsSendingPhoneOTP(false);
    }
  };

  const handleClosePhoneModal = () => {
    setShowPhoneModal(false);
    setModalPhoneOTP('');
    setPhoneTimer(0);
    setCanResendPhone(false);
    setErrors({});
  };


  const handleModalResendOTP = async () => {
    if (phoneTimer > 0) return;

    setIsSendingPhoneOTP(true);
    try {
      const fullPhone = `${modalCountryCode}${modalPhoneNumber.replace(/\D/g, '')}`;
      const response = await api.post('/users/sendphoneotp', {
        phone: modalPhoneNumber.replace(/\D/g, ''),
      }, {
        headers: {
          Authorization: `Bearer ${tokenStorage.getToken()}`
        }
      });

      if (response.success || response.message) {
        showSuccess('OTP resent to your phone number');
        setPhoneTimer(60);
        setCanResendPhone(false);
        setModalPhoneOTP('');
      }
    } catch (error) {
      showError(error?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsSendingPhoneOTP(false);
    }
  };

  const handleModalVerifyOTP = async (otpValue = modalPhoneOTP) => {
    if (!otpValue || otpValue.length !== 6) {
      setErrors(prev => ({ ...prev, modalOTP: 'Please enter a valid 6-digit code' }));
      return;
    }

    setIsVerifyingPhone(true);
    setErrors(prev => ({ ...prev, modalOTP: null }));

    try {
      const response = await api.post('/auth/verify-otp', {
        otp: otpValue,
        verification_type: "phone",
      }, {
        headers: {
          authorizationtoken: `${verificationData.temp_token}`
        }
      });

      if (response.verified || response.success) {
        setLevel1Data(prev => ({ ...prev, phoneVerified: true }));
        showSuccess('Phone verified successfully!');
        handleClosePhoneModal();
        // Submit Level 1 after verification
        await handleSubmitKYC();
      }
    } catch (error) {
      showError(error?.message || 'Invalid OTP. Please try again.');
      setModalPhoneOTP('');
      setErrors(prev => ({ ...prev, modalOTP: error?.message || 'Invalid OTP' }));
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleContinue = async () => {
    // Level 1: Both email and phone should be verified
    if (currentLevel === 1) {
      if (level1Data.emailVerified && level1Data.phoneVerified) {
        await handleSubmitKYC();
        return;
      }
    }

    // Level 2: Validate and continue
    let isValid = false;
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      case 4:
        isValid = validateStep4();
        break;
      default:
        isValid = true;
    }

    if (!isValid) {
      const stepFields = getStepFields(currentStep);
      const newTouched = { ...touched };
      stepFields.forEach(field => {
        newTouched[field] = true;
      });
      setTouched(newTouched);
      showError('Please fix the errors before continuing');
      return;
    }

    // Level 2: Continue to next step or submit
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      await handleSubmitKYC();
    }
  };

  const getStepFields = (step) => {
    switch (step) {
      case 1:
        return ['fullName', 'dateOfBirth', 'nationality', 'address.street', 'address.city', 'address.state', 'address.zipCode'];
      case 2:
        return ['documentType', 'documentFront', 'documentBack'];
      case 3:
        return ['selfie'];
      case 4:
        return ['addressProof'];
      default:
        return [];
    }
  };

  const handleSubmitKYC = async () => {
    try {
      setIsLoading(true);

      // Level 1: Only phone verification required (Email is already verified during registration)
      if (currentLevel === 1) {
        if (!level1Data.phoneVerified) {
          showError('Please verify your phone number');
          setIsLoading(false);
          return;
        }
        // Email should already be verified
        if (!level1Data.emailVerified) {
          showError('Email verification is required. Please contact support.');
          setIsLoading(false);
          return;
        }

        const formDataToSubmit = new FormData();
        formDataToSubmit.append('level', '1');
        formDataToSubmit.append('email_verified', 'true');
        formDataToSubmit.append('phone_verified', 'true');

        const token = tokenStorage.getToken();
        if (!token) {
          throw new Error('Authentication required. Please login again.');
        }

        const kycSubmitUrl = `${API_BASE_URL.replace(/\/$/, '')}/profile/kyc/submit`;
        const response = await fetch(kycSubmitUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formDataToSubmit,
        });

        const contentType = response.headers.get('content-type');
        let responseData = null;

        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          if (text && text.trim().length > 0) {
            try {
              responseData = JSON.parse(text);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              throw new Error('Invalid response format from server');
            }
          } else {
            responseData = {};
          }
        } else {
          const text = await response.text();
          if (text && text.trim().length > 0) {
            try {
              responseData = JSON.parse(text);
            } catch {
              responseData = { message: text || 'Request processed' };
            }
          } else {
            responseData = {};
          }
        }

        if (!response.ok) {
          const errorMessage = responseData?.message ||
            responseData?.error ||
            responseData?.data?.message ||
            `Failed to submit Level 1 verification (Status: ${response.status})`;
          throw new Error(errorMessage);
        }

        if (responseData.success || responseData.kyc_status || response.status >= 200 && response.status < 300) {
          showSuccess('Level 1 verification completed successfully! You can now proceed to Level 2.');
          await fetchKYCStatus();
          if (responseData.kyc_status === 'verified' || responseData.level >= 1) {
            setCurrentLevel(2);
            setCurrentStep(1);
          }
        } else {
          throw new Error(responseData?.message || 'Failed to submit Level 1 verification');
        }
        return;
      }

      // Level 2: Full KYC validation
      if (!formData.fullName || !formData.dateOfBirth.year || !formData.dateOfBirth.month || !formData.dateOfBirth.day) {
        showError('Please fill in all required personal information fields.');
        setIsLoading(false);
        return;
      }

      // Level 2 specific validations
      if (currentLevel === 2) {
        if (!formData.documentFront) {
          showError('Please upload document front image.');
          setIsLoading(false);
          return;
        }

        if ((formData.documentType === 'national-id' || formData.documentType === 'drivers-license') && !formData.documentBack) {
          showError('Please upload document back image.');
          setIsLoading(false);
          return;
        }

        if (!formData.selfie) {
          showError('Please upload selfie with document.');
          setIsLoading(false);
          return;
        }

        if (!formData.addressProof) {
          showError('Please upload proof of address.');
          setIsLoading(false);
          return;
        }
      }

      const formDataToSubmit = new FormData();
      formDataToSubmit.append('level', currentLevel.toString());
      formDataToSubmit.append('full_name', formData.fullName);
      formDataToSubmit.append('dob', `${formData.dateOfBirth.year}-${formData.dateOfBirth.month}-${formData.dateOfBirth.day}`);
      formDataToSubmit.append('nationality', formData.nationality);
      formDataToSubmit.append('address', JSON.stringify(formData.address));

      // Level 2 specific fields
      if (currentLevel === 2) {
        formDataToSubmit.append('document_type', formData.documentType);
        formDataToSubmit.append('document_front', formData.documentFront);

        if (formData.documentBack) {
          formDataToSubmit.append('document_back', formData.documentBack);
        }
        formDataToSubmit.append('selfie', formData.selfie);
        formDataToSubmit.append('address_proof', formData.addressProof);
      }

      const token = tokenStorage.getToken();
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      const kycSubmitUrl = `${API_BASE_URL.replace(/\/$/, '')}/profile/kyc/submit`;
      const response = await fetch(kycSubmitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData, browser will set it with boundary
        },
        body: formDataToSubmit,
      });

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      let responseData = null;

      // Handle response based on content type
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          try {
            responseData = JSON.parse(text);
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid response format from server');
          }
        } else {
          // Empty JSON response
          responseData = {};
        }
      } else {
        // Non-JSON response
        const text = await response.text();
        if (text && text.trim().length > 0) {
          try {
            responseData = JSON.parse(text);
          } catch {
            responseData = { message: text || 'Request processed' };
          }
        } else {
          responseData = {};
        }
      }

      if (!response.ok) {
        const errorMessage = responseData?.message ||
          responseData?.error ||
          responseData?.data?.message ||
          `Failed to submit KYC documents (Status: ${response.status})`;
        throw new Error(errorMessage);
      }

      // Success case - check for various success indicators
      if (responseData.success ||
        responseData.kyc_status ||
        response.status >= 200 && response.status < 300) {
        if (currentLevel === 1) {
          showSuccess('Level 1 verification submitted successfully! You can now proceed to Level 2.');
          await fetchKYCStatus();
          // Auto-advance to Level 2 if Level 1 is verified
          if (responseData.kyc_status === 'verified' || responseData.level >= 1) {
            setCurrentLevel(2);
            setCurrentStep(1);
          }
        } else {
          setVerificationStatus('under-review');
          showSuccess('KYC documents submitted successfully! Review will take 24-48 hours.');
          await fetchKYCStatus();
        }
      } else {
        throw new Error(responseData?.message || 'Failed to submit KYC documents');
      }
    } catch (error) {
      console.error('Error submitting KYC:', error);

      // Handle different error types
      let errorMessage = 'Failed to submit KYC documents. Please try again.';

      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        errorMessage = 'Server response error. Please try again or contact support.';
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Helper functions for masking
  const maskEmail = (email) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 4))}@${domain}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return phone;
    return `+${cleaned.slice(0, 2)} ${'*'.repeat(cleaned.length - 4)}${cleaned.slice(-2)}`;
  };

  const renderStepContent = () => {
    // Level 1: Show Email and Phone Status (like email verification)
    if (currentLevel === 1) {
      if (currentStep === 1) {
        return (
          <div className="stepContent">
            {/* Email Already Verified Status */}
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              // marginBottom: 'var(--space-lg)',
              marginTop: 'var(--space-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22c55e', flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: '#22c55e', fontWeight: 'var(--weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                  Email Already Verified
                </p>
                <p style={{ margin: 'var(--space-xs) 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                  {level1Data.email ? maskEmail(level1Data.email) : 'Email verified during registration'}
                </p>
              </div>
            </div>

            {/* Phone Verification Status */}
            {level1Data.phoneVerified ? (
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22c55e', flexShrink: 0 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: '#22c55e', fontWeight: 'var(--weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                    Phone Already Verified
                  </p>
                  <p style={{ margin: 'var(--space-xs) 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    {level1Data.phone ? maskPhone(level1Data.phone) : 'Phone verified'}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                      Phone Verification Pending
                    </p>
                    <p style={{ margin: 'var(--space-xs) 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {level1Data.phone ? maskPhone(level1Data.phone) : 'Verify your phone number to complete Level 1'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenPhoneModal}
                  className="continueButton"
                  style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    fontSize: 'var(--font-size-sm)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Verify Phone
                </button>
              </div>
            )}

            {/* Complete Level 1 Button */}
            {level1Data.emailVerified && level1Data.phoneVerified && (
              <div className="stepActions">
                <button className="continueButton" onClick={handleContinue} style={{ width: '100%' }}>
                  Complete Level 1 →
                </button>
              </div>
            )}
          </div>
        );
      }
    }

    // Level 2: Full KYC Steps
    switch (currentStep) {
      case 1:
        return (
          <div className="stepContent">
            <div className="formGroup">
              <label className="formLabel">
                Full Legal Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`formInput ${errors.fullName ? 'error' : ''}`}
                placeholder="John Michael Doe"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, fullName: true }))}
              />
              {errors.fullName && touched.fullName && (
                <span className="fieldError">{errors.fullName}</span>
              )}
            </div>

            <div className="formGroup">
              <label className="formLabel">
                Date of Birth <span className="required">*</span>
              </label>
              <div className="dateInputGroup">
                <CustomSelect
                  className={`dateSelect ${errors.dateOfBirth ? 'error' : ''}`}
                  value={formData.dateOfBirth.month}
                  onChange={(e) => handleDateChange('month', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, 'dateOfBirth.month': true }))}
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {String(i + 1).padStart(2, '0')}
                    </option>
                  ))}
                </CustomSelect>
                <CustomSelect
                  className={`dateSelect ${errors.dateOfBirth ? 'error' : ''}`}
                  value={formData.dateOfBirth.day}
                  onChange={(e) => handleDateChange('day', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, 'dateOfBirth.day': true }))}
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {String(i + 1).padStart(2, '0')}
                    </option>
                  ))}
                </CustomSelect>
                <CustomSelect
                  className={`dateSelect ${errors.dateOfBirth ? 'error' : ''}`}
                  value={formData.dateOfBirth.year}
                  onChange={(e) => handleDateChange('year', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, 'dateOfBirth.year': true }))}
                >
                  <option value="">Year</option>
                  {Array.from({ length: 100 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </CustomSelect>
              </div>
              {errors.dateOfBirth && (touched['dateOfBirth.month'] || touched['dateOfBirth.day'] || touched['dateOfBirth.year']) && (
                <span className="fieldError">{errors.dateOfBirth}</span>
              )}
            </div>

            <div className="formGroup">
              <label className="formLabel">
                Nationality <span className="required">*</span>
              </label>
              <CustomSelect
                className={`formSelect ${errors.nationality ? 'error' : ''}`}
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, nationality: true }))}
              >
                <option value="">Select Nationality</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Other">Other</option>
              </CustomSelect>
              {errors.nationality && touched.nationality && (
                <span className="fieldError">{errors.nationality}</span>
              )}
            </div>

            <div className="formGroup">
              <label className="formLabel">
                Residential Address <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`formInput ${errors['address.street'] ? 'error' : ''}`}
                placeholder="123 Main Street"
                value={formData.address.street}
                onChange={(e) => handleInputChange('address.street', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, 'address.street': true }))}
              />
              {errors['address.street'] && touched['address.street'] && (
                <span className="fieldError">{errors['address.street']}</span>
              )}
              <input
                type="text"
                className="formInput"
                placeholder="Apt 4B (Optional)"
                value={formData.address.apartment}
                onChange={(e) => handleInputChange('address.apartment', e.target.value)}
                style={{ marginTop: 'var(--space-sm)' }}
              />
              <div className="addressRow">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <input
                    type="text"
                    className={`formInput ${errors['address.city'] ? 'error' : ''}`}
                    placeholder="New York"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, 'address.city': true }))}
                  />
                  {errors['address.city'] && touched['address.city'] && (
                    <span className="fieldError">{errors['address.city']}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <input
                    type="text"
                    className={`formInput ${errors['address.state'] ? 'error' : ''}`}
                    placeholder="NY"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, 'address.state': true }))}
                  />
                  {errors['address.state'] && touched['address.state'] && (
                    <span className="fieldError">{errors['address.state']}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <input
                    type="text"
                    className={`formInput ${errors['address.zipCode'] ? 'error' : ''}`}
                    placeholder="10001"
                    value={formData.address.zipCode}
                    onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, 'address.zipCode': true }))}
                  />
                  {errors['address.zipCode'] && touched['address.zipCode'] && (
                    <span className="fieldError">{errors['address.zipCode']}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="stepActions">
              <button className="continueButton" onClick={handleContinue}>
                {currentLevel === 1 ? 'Submit Level 1 Verification' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="stepContent">
            <div className="formGroup">
              <label className="formLabel">
                Select Document Type <span className="required">*</span>
              </label>
              <div className="radioGroup">
                <label className="radioLabel">
                  <input
                    type="radio"
                    name="documentType"
                    value="passport"
                    checked={formData.documentType === 'passport'}
                    onChange={(e) => handleInputChange('documentType', e.target.value)}
                  />
                  <span>Passport</span>
                </label>
                <label className="radioLabel">
                  <input
                    type="radio"
                    name="documentType"
                    value="national-id"
                    checked={formData.documentType === 'national-id'}
                    onChange={(e) => handleInputChange('documentType', e.target.value)}
                  />
                  <span>National ID Card</span>
                </label>
                <label className="radioLabel">
                  <input
                    type="radio"
                    name="documentType"
                    value="drivers-license"
                    checked={formData.documentType === 'drivers-license'}
                    onChange={(e) => handleInputChange('documentType', e.target.value)}
                  />
                  <span>Driver's License</span>
                </label>
              </div>
            </div>

            <div className="formGroup">
              <label className="formLabel">
                Document Front <span className="required">*</span>
              </label>
              <div className={`uploadArea ${errors.documentFront ? 'error' : ''}`}>
                {formData.documentFront ? (
                  <div className="uploadedFile">
                    <span className="fileIcon">📄</span>
                    <span className="fileName">{formData.documentFront.name}</span>
                    <button
                      className="fileAction"
                      onClick={() => handleFileUpload('documentFront', null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="uploadLabel">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('documentFront', e.target.files[0])}
                      className="fileInput"
                    />
                    <div className="uploadContent">
                      <span className="uploadIcon">📤</span>
                      <p className="uploadText">Drag & drop or click to upload</p>
                      <p className="uploadHint">JPG, PNG • Max 10MB • Min 300 DPI</p>
                    </div>
                  </label>
                )}
              </div>
              {errors.documentFront && touched.documentFront && (
                <span className="fieldError">{errors.documentFront}</span>
              )}
            </div>

            {(formData.documentType === 'national-id' || formData.documentType === 'drivers-license') && (
              <div className="formGroup">
                <label className="formLabel">
                  Document Back <span className="required">*</span>
                </label>
                <div className={`uploadArea ${errors.documentBack ? 'error' : ''}`}>
                  {formData.documentBack ? (
                    <div className="uploadedFile">
                      <span className="fileIcon">📄</span>
                      <span className="fileName">{formData.documentBack.name}</span>
                      <button
                        className="fileAction"
                        onClick={() => handleFileUpload('documentBack', null)}
                      >
                        Change
                      </button>
                      <button
                        className="fileAction remove"
                        onClick={() => handleFileUpload('documentBack', null)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="uploadLabel">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload('documentBack', e.target.files[0])}
                        className="fileInput"
                      />
                      <div className="uploadContent">
                        <span className="uploadIcon">📤</span>
                        <p className="uploadText">Drag & drop or click to upload</p>
                        <p className="uploadHint">JPG, PNG • Max 10MB • Min 300 DPI</p>
                      </div>
                    </label>
                  )}
                </div>
                {errors.documentBack && touched.documentBack && (
                  <span className="fieldError">{errors.documentBack}</span>
                )}
              </div>
            )}

            <div className="requirementsBox">
              <p className="requirementsTitle">Requirements:</p>
              <ul className="requirementsList">
                <li>Clear, readable document</li>
                <li>All corners visible</li>
                <li>No glare or shadows</li>
                <li>Color image (not black & white)</li>
              </ul>
            </div>

            <div className="stepActions">
              <button className="backButton" onClick={handleBack}>
                ← Back
              </button>
              <button className="continueButton" onClick={handleContinue}>
                Continue →
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="stepContent">
            <div className="formGroup">
              <p className="stepDescription">
                Take a selfie holding your document
              </p>
              <div className="cameraPreview">
                {formData.selfie ? (
                  <div className="previewImage">
                    <img src={URL.createObjectURL(formData.selfie)} alt="Selfie" />
                    <button
                      className="retakeButton"
                      onClick={() => handleFileUpload('selfie', null)}
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div className="cameraPlaceholder">
                    <span className="cameraIcon">📷</span>
                    <p className="cameraText">Camera Preview</p>
                    <label className="cameraButton">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={(e) => handleFileUpload('selfie', e.target.files[0])}
                        className="fileInput"
                      />
                      ○ Capture Photo
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="instructionsBox">
              <p className="instructionsTitle">Instructions:</p>
              <ol className="instructionsList">
                <li>Hold your ID next to your face</li>
                <li>Ensure good lighting</li>
                <li>Face the camera directly</li>
                <li>Remove glasses/hats</li>
              </ol>
            </div>

            <div className="formGroup">
              <p className="uploadAlternative">Or upload existing photo:</p>
              <label className="fileUploadButton">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload('selfie', e.target.files[0])}
                  className="fileInput"
                />
                Choose File
              </label>
            </div>

            <div className="stepActions">
              <button className="backButton" onClick={handleBack}>
                ← Back
              </button>
              <button className="continueButton" onClick={handleContinue}>
                Continue →
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="stepContent">
            <div className="formGroup">
              <p className="stepDescription">
                Upload proof of address (not older than 3 months)
              </p>
            </div>

            <div className="acceptedDocuments">
              <p className="documentsTitle">Accepted Documents:</p>
              <ul className="documentsList">
                <li>Utility bill (electricity, water, gas)</li>
                <li>Bank statement</li>
                <li>Government-issued document</li>
                <li>Tax document</li>
              </ul>
            </div>

            <div className="formGroup">
              <div className="uploadArea large">
                {formData.addressProof ? (
                  <div className="uploadedFile">
                    <span className="fileIcon">📄</span>
                    <span className="fileName">{formData.addressProof.name}</span>
                    <button
                      className="fileAction"
                      onClick={() => handleFileUpload('addressProof', null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="uploadLabel">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => handleFileUpload('addressProof', e.target.files[0])}
                      className="fileInput"
                    />
                    <div className="uploadContent">
                      <span className="uploadIcon">📤</span>
                      <p className="uploadText">Drag & drop proof of address</p>
                      <p className="uploadHint">PDF, JPG, PNG • Max 10MB</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div className="addressMatchBox">
              <p className="matchTitle">Your address must match:</p>
              <div className="addressDisplay">
                <p>{formData.address.street || '123 Main Street'}, {formData.address.apartment || 'Apt 4B'}</p>
                <p>{formData.address.city || 'New York'}, {formData.address.state || 'NY'} {formData.address.zipCode || '10001'}</p>
                <p>{formData.nationality || 'United States'}</p>
              </div>
            </div>

            <div className="stepActions">
              <button className="backButton" onClick={handleBack}>
                ← Back
              </button>
              <button className="submitButton" onClick={handleContinue}>
                Submit for Review →
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading && !kycData) {
    return (
      <div className="kycVerification">
        <div className="verificationStatusCard">
          <div className="statusHeader">
            <h2 className="statusTitle">Loading KYC Status...</h2>
          </div>
          <p className="statusDescription">Please wait while we fetch your verification status.</p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div className="kycVerification">
        <div className="verificationStatusCard">
          <div className="statusHeader">
            <h2 className="statusTitle">Verification Status: Rejected</h2>
            <span className="statusIcon">❌</span>
          </div>
          <p className="statusDescription">
            Your KYC verification has been rejected. Please review the reason and resubmit.
          </p>
          {kycData?.rejection_reason && (
            <div className="statusInfo">
              <p><strong>Rejection Reason:</strong></p>
              <p>{kycData.rejection_reason}</p>
            </div>
          )}
          <div className="statusInfo">
            {kycData?.submitted_at && (
              <p><strong>Submitted:</strong> {new Date(kycData.submitted_at).toLocaleString()}</p>
            )}
          </div>
          <button className="supportButton" onClick={() => setVerificationStatus('in-progress')}>
            Resubmit Documents
          </button>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'under-review') {
    return (
      <div className="kycVerification">
        <div className="verificationStatusCard">
          <div className="statusHeader">
            <h2 className="statusTitle">Verification Status: Under Review</h2>
            <span className="statusIcon">⏳</span>
          </div>
          <p className="statusDescription">
            Your documents have been submitted for verification.
          </p>
          <div className="statusInfo">
            <p><strong>Estimated Review Time:</strong> 24-48 hours</p>
            {kycData?.submitted_at && (
              <p><strong>Submitted:</strong> {new Date(kycData.submitted_at).toLocaleString()}</p>
            )}
          </div>
          <div className="notificationsList">
            <p className="notificationsTitle">We'll notify you via:</p>
            <ul>
              <li>✓ Email notification</li>
              <li>✓ In-app notification</li>
              <li>✓ SMS notification</li>
            </ul>
          </div>
          <div className="documentsSubmitted">
            <p className="documentsTitle">Documents Submitted:</p>
            <ul>
              <li>✓ Personal Information</li>
              <li>✓ National ID Card (Front & Back)</li>
              <li>✓ Selfie with ID</li>
              <li>✓ Proof of Address</li>
            </ul>
          </div>
          <button className="supportButton">Contact Support</button>
        </div>
      </div>
    );
  }

  return (
    <div className="kycVerification">
      <div className="levelsOverview">
        <h2 className="sectionTitle">Identity Verification Levels</h2>
        <div className="levelsGrid" style={{ marginTop: 'var(--space-md)' }}>
          {verificationLevels.map((level) => (
            <div key={level.level} className={`levelCard ${level.status}`}>
              <div className="levelHeader">
                {level.status === 'completed' && <span className="checkIcon">✓</span>}
                {level.status === 'in-progress' && <span className="arrowIcon">→</span>}
                <h3 className="levelName">Level {level.level}</h3>
                <span className="levelType">{level.name}</span>
              </div>
              <div className="levelStatus">
                {level.status === 'completed' && 'Completed'}
                {level.status === 'in-progress' && 'In Progress'}
                {level.status === 'available' && 'Available'}
                {level.status === 'locked' && 'Locked'}
              </div>
              {level.status === 'available' && level.level === 1 && (
                <button
                  className="startLevelButton"
                  onClick={() => {
                    setCurrentLevel(1);
                    setCurrentStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Start Verification
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="benefitsSection">
          <div className="currentBenefits">
            <h4 className="benefitsTitle">Current Benefits:</h4>
            <ul className="benefitsList">
              {verificationLevels[0].benefits.map((benefit, index) => (
                <li key={index}>✓ {benefit}</li>
              ))}
            </ul>
          </div>
          <div className="nextLevelBenefits">
            <h4 className="benefitsTitle">Level 2 Benefits:</h4>
            <ul className="benefitsList">
              {verificationLevels[1].benefits.map((benefit, index) => (
                <li key={index}>• {benefit}</li>
              ))}
            </ul>
          </div>
        </div>

        {verificationLevels[0].status === 'available' && (
          <button
            className="continueVerificationButton"
            onClick={() => {
              setCurrentLevel(1);
              setCurrentStep(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Start Level 1 Verification →
          </button>
        )}
        {verificationLevels[0].status === 'completed' && verificationLevels[1].status !== 'locked' && (
          <button
            className="continueVerificationButton"
            onClick={() => {
              setCurrentLevel(2);
              setCurrentStep(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Continue Level 2 Verification →
          </button>
        )}
      </div>

      {/* Level 1 Status Card */}
      {verificationLevels[0].status === 'completed' && (
        <div className="levelStatusCard completed">
          <h3 className="levelStatusTitle">Level 1 - Basic Verification</h3>
          <p className="levelStatusText">Status: ✓ Completed</p>
          <ul className="levelStatusList">
            <li>Email verification ✓</li>
            <li>Phone number verification ✓</li>
            <li>Personal information verified ✓</li>
            <li>Benefits unlocked: Basic trading, $50K daily limit</li>
          </ul>
        </div>
      )}

      {/* Level 1 Verification Form */}
      {currentLevel === 1 && verificationLevels[0].status !== 'completed' && (
        <div className="verificationSteps">
          <div className="stepsHeader">
            <h3 className="stepsTitle">Level 1 - Basic Verification</h3>
            <div className="stepsProgress">
              Step {currentStep} of {steps.length}
            </div>
          </div>

          <div className="stepsIndicator">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`stepIndicator ${step.id === currentStep ? 'active' : ''} ${step.completed ? 'completed' : ''}`}
              >
                <div className="stepNumber">{step.completed ? '✓' : step.id}</div>
                <span className="stepLabel">{step.title}</span>
              </div>
            ))}
          </div>

          <div className="stepCard">
            <div className="stepHeader">
              <h4 className="stepTitle">
                {steps[currentStep - 1].title}
              </h4>
              <span className="stepCounter">
                [{currentStep}/{steps.length} Complete]
              </span>
            </div>
            {renderStepContent()}
          </div>
        </div>
      )}

      {/* Level 2 Verification Form */}
      {
        
      }
      {currentLevel === 2 && (
        <div className="verificationSteps">
          <div className="stepsHeader">
            <h3 className="stepsTitle">Level 2 - Advanced Verification</h3>
            <div className="stepsProgress">
              Step {currentStep} of {steps.length}
            </div>
          </div>

          <div className="stepsIndicator">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`stepIndicator ${step.id === currentStep ? 'active' : ''} ${step.completed ? 'completed' : ''}`}
              >
                <div className="stepNumber">{step.completed ? '✓' : step.id}</div>
                <span className="stepLabel">{step.title}</span>
              </div>
            ))}
          </div>

          <div className="stepCard">
            <div className="stepHeader">
              <h4 className="stepTitle">
                {steps[currentStep - 1].title}
              </h4>
              <span className="stepCounter">
                [{currentStep}/{steps.length} Complete]
              </span>
            </div>
            {renderStepContent()}
          </div>
        </div>
      )}

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <div className="phoneVerificationModalOverlay" onClick={handleClosePhoneModal}>
          <div className="phoneVerificationModal" onClick={(e) => e.stopPropagation()}>
            <div className="phoneVerificationModalHeader">
              <div>
                <h3 className="phoneVerificationModalTitle">Verify Phone Number</h3>
                <p className="phoneVerificationModalSubtitle">
                  Enter the verification code sent to your phone
                </p>
              </div>
              <button
                type="button"
                className="phoneVerificationModalClose"
                onClick={handleClosePhoneModal}
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="phoneVerificationModalContent">
              <>
                {isSendingPhoneOTP ? (
                  <div style={{
                    padding: 'var(--ark-space-lg)',
                    backgroundColor: 'var(--ark-bg-tertiary)',
                    border: '1px solid var(--ark-border)',
                    borderRadius: 'var(--ark-radius-lg)',
                    marginBottom: 'var(--ark-space-lg)',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--ark-space-sm)', marginBottom: 'var(--ark-space-xs)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', color: 'var(--ark-primary)' }}>
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                      <p style={{
                        fontSize: 'var(--ark-font-size-sm)',
                        color: 'var(--ark-text-primary)',
                        margin: 0,
                        fontWeight: 'var(--ark-weight-medium)'
                      }}>
                        Sending OTP...
                      </p>
                    </div>
                    <p style={{
                      fontSize: 'var(--ark-font-size-xs)',
                      color: 'var(--ark-text-secondary)',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Please wait while we send the code to {modalPhoneNumber ? maskPhone(`${modalCountryCode}${modalPhoneNumber}`) : 'your phone'}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: 'var(--ark-space-md)',
                    backgroundColor: 'var(--ark-bg-tertiary)',
                    border: '1px solid var(--ark-border)',
                    borderRadius: 'var(--ark-radius-lg)',
                    marginBottom: 'var(--ark-space-lg)',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: 'var(--ark-font-size-xs)',
                      color: 'var(--ark-text-secondary)',
                      margin: 0,
                      marginBottom: 'var(--ark-space-xs)',
                      lineHeight: '1.5'
                    }}>
                      Code sent to
                    </p>
                    <p style={{
                      fontSize: 'var(--ark-font-size-sm)',
                      color: 'var(--ark-text-primary)',
                      margin: 0,
                      fontFamily: 'monospace',
                      fontWeight: 'var(--ark-weight-medium)',
                      lineHeight: '1.5'
                    }}>
                      {modalPhoneNumber ? maskPhone(`${modalCountryCode}${modalPhoneNumber}`) : 'Phone number'}
                    </p>
                  </div>
                )}

                <div className="formGroup">
                  <label className="formLabel" style={{ textAlign: 'center', display: 'block', marginBottom: 'var(--ark-space-md)' }}>
                    Enter Verification Code
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--ark-space-xs)' }}>
                    <OTPInput
                      value={modalPhoneOTP}
                      onChange={(value) => {
                        setModalPhoneOTP(value);
                        if (errors.modalOTP) {
                          setErrors(prev => ({ ...prev, modalOTP: null }));
                        }
                      }}
                      onComplete={handleModalVerifyOTP}
                      error={!!errors.modalOTP}
                      disabled={isVerifyingPhone}
                    />
                  </div>
                  {errors.modalOTP && (
                    <span className="fieldError" style={{ textAlign: 'center', display: 'block', marginTop: 'var(--ark-space-xs)' }}>
                      {errors.modalOTP}
                    </span>
                  )}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 'var(--ark-space-lg)' }}>
                  {phoneTimer > 0 ? (
                    <p style={{ color: 'var(--ark-text-tertiary)', fontSize: 'var(--ark-font-size-sm)' }}>
                      Resend code in <span style={{ fontFamily: 'monospace', color: 'var(--ark-text-primary)', fontWeight: 'var(--ark-weight-medium)' }}>
                        {formatTimer(phoneTimer)}
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleModalResendOTP}
                      disabled={isSendingPhoneOTP}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ark-primary)',
                        cursor: isSendingPhoneOTP ? 'not-allowed' : 'pointer',
                        opacity: isSendingPhoneOTP ? 0.6 : 1,
                        padding: 0,
                        fontSize: 'var(--ark-font-size-sm)',
                        textDecoration: 'underline',
                        fontFamily: 'var(--ark-font-family)'
                      }}
                    >
                      {isSendingPhoneOTP ? 'Sending...' : "Didn't receive code? Resend"}
                    </button>
                  )}
                </div>

                <div className="phoneVerificationModalActions">
                  <button
                    type="button"
                    className="phoneVerificationModalButton phoneVerificationModalButtonSecondary"
                    onClick={handleClosePhoneModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="phoneVerificationModalButton phoneVerificationModalButtonPrimary"
                    onClick={() => handleModalVerifyOTP()}
                    disabled={!modalPhoneOTP || modalPhoneOTP.length !== 6 || isVerifyingPhone}
                  >
                    {isVerifyingPhone ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--ark-space-sm)', animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      'Verify & Complete'
                    )}
                  </button>
                </div>
              </>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KYCVerification;

