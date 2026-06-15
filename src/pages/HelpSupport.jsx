import { useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { validateEmailInput, validatePhone, validateText } from "../utils/validators";
import { sanitizeInput } from "../utils/security";
import { useUser } from "../contexts/UserContext";
import Header from "../components/Header";
import api from "../services/api";
import CountryCodeSelector from "../components/CountryCodeSelector";
import "../styles/components/HelpSupport.css";

const PHONE_MAX_LENGTH_MAP = {
  '+91': 10,
  '+1': 10,
  '+44': 10,
  '+86': 11,
  '+81': 10,
  '+49': 11,
  '+33': 9,
  '+61': 9,
  '+971': 9,
  '+65': 8,
  '+60': 10,
  '+66': 9,
  '+62': 12,
  '+84': 10,
  '+63': 10,
  '+82': 10,
  '+55': 11,
};

const INITIAL_FORM = {
  firstname: "",
  lastname: "",
  // email: "",
  countryCode: "+91",
  phone: "",
  note: "",
  agreeToContact: false,
};

const faqData = [
  {
    question: "What Is M5dex Dashboard?",
    paragraphs: [
      "M5dex Dashboard is your all-in-one trading control center where you can access and manage different markets from one place.",
      "It allows users to view market activity, manage their account, track balances, monitor trades, and access platform features related to Indian markets, cryptocurrency, forex, and other available trading services.",
      "The dashboard is designed to make trading simple, organized, and easy to manage for both new and experienced users.",
    ],
  },
  {
    question: "How Do I Create An Account?",
    paragraphs: [
      "Creating an account on M5dex is quick and simple.",
      "Click on the Sign Up or Create Account button, enter your basic details such as name, email address, and mobile number, then set a secure password.",
      "After registration, you may need to verify your email or phone number and complete any required identity verification before accessing all trading features. Once your account is verified, you can log in and start using the M5dex Dashboard.",
    ],
  },
  {
    question: "Is My Account Secure On M5dex?",
    paragraphs: [
      "Yes, M5dex is designed with user account security in mind.",
      "The platform uses security measures such as secure login, account verification, data protection practices, and controlled access to help keep your information safe.",
      "For better protection, we recommend using a strong password, keeping your login details private, and enabling additional security features if available. Please note that users are also responsible for keeping their account credentials secure.",
    ],
  },
  {
    question: "I Forgot My Password. What Should I Do?",
    paragraphs: [
      "If you forgot your password, you can easily reset it from the login page.",
      "Click on Forgot Password, enter your registered email address or mobile number, and follow the instructions sent to you.",
      "After verification, you can create a new password and regain access to your account. For security reasons, choose a strong password and avoid using the same password across multiple platforms.",
    ],
  },
  {
    question: "How Can I Deposit Funds?",
    paragraphs: [
      "You can deposit funds directly from your M5dex Dashboard.",
      "Log in to your account, go to the Deposit section, choose your preferred supported payment method, enter the amount, and follow the on-screen instructions.",
      "Deposit options, processing time, and minimum deposit limits may vary depending on your account type, location, and available payment methods. Always make sure you are depositing through the official M5dex platform only.",
    ],
  },
];

const HelpSupport = () => {
  const { user } = useUser()
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const phoneMaxLength = PHONE_MAX_LENGTH_MAP[formData.countryCode] ?? 15;

  const handleChange = (field, value) => {
    const isCheckbox = field === "agreeToContact";
    let nextValue = value;
    if (field === "phone") {
      nextValue = String(value ?? "")
        .replace(/\D/g, "")
        .slice(0, phoneMaxLength);
    } else if (!isCheckbox) {
      nextValue = sanitizeInput(String(value ?? ""));
    }
    setFormData((prev) => ({
      ...prev,
      [field]: isCheckbox ? !!value : nextValue,
    }));
    if (field === "phone") {
      if (errors.phoneno) setErrors((prev) => ({ ...prev, phoneno: null }));
    } else {
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const firstnameVal = validateText(formData.firstname, { required: true, minLength: 1, maxLength: 100 });
    const lastnameVal = validateText(formData.lastname, { required: true, minLength: 1, maxLength: 100 });
    const noteVal = validateText(formData.note, { required: true, minLength: 10, maxLength: 2000 });

    const newErrors = {};
    if (!firstnameVal.isValid) newErrors.firstname = firstnameVal.error;
    if (!lastnameVal.isValid) newErrors.lastname = lastnameVal.error;
    if (!noteVal.isValid) newErrors.note = noteVal.error;
    if (!formData.agreeToContact) newErrors.agreeToContact = "You must agree to be contacted for issue resolution.";

    // Phone validation (exactly like SignUp.jsx)
    if (!formData.phone || formData.phone.trim().length === 0) {
      newErrors.phoneno = 'Phone number is required';
    } else {
      const cleanedPhone = formData.phone.replace(/\D/g, '');
      if (cleanedPhone.length !== phoneMaxLength) {
        newErrors.phoneno = `Phone number must be ${phoneMaxLength} digits`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        email: user?.email,
        phoneno: `${formData.countryCode}${formData.phone.replace(/\D/g, "").trim()}`,
        note: formData.note.trim(),
      };
      const response = await api.post("/users/addticket", payload);

      if (response?.status === true || response?.success || response?.message) {
        showSuccess(response?.message || "Your ticket has been submitted. We'll get back to you soon.");
        setFormData(INITIAL_FORM);
      } else {
        throw new Error(response?.message || "Failed to submit ticket.");
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Unable to submit ticket. Please try again.";
      showError(msg);
      setErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <>
      <Header />
      <div className="helps-page">
        <div className="mexcProfileOverview">
          <div className="profileHeading">
            <h1 className="HelpHeader">Contact Us</h1>
            <p className="HelpDescription">
              Got Questions? Reach Out! We're Here And Ready To Assist.
            </p>
          </div>

          <div className="HelpMainContent">
            <div className="HelpCardBg">
              <form className="ark-form" onSubmit={handleSubmit} noValidate>
                {errors.submit && (
                  <div className="help-form-error-banner" role="alert">
                    {errors.submit}
                  </div>
                )}
                <div className="HelpForm">
                  <div className="ark-form-group help-form-group">
                    <label className="help-form-label" htmlFor="help-firstname">
                      First Name <span className="help-required">*</span>
                    </label>
                    <div className="ark-input-wrapper">
                      <input
                        id="help-firstname"
                        name="firstname"
                        type="text"
                        placeholder="First Name"
                        className={`ark-input HelpInput ${errors.firstname ? "ark-input-error" : ""}`}
                        value={formData.firstname}
                        onChange={(e) => handleChange("firstname", e.target.value)}
                        autoComplete="given-name"
                        aria-invalid={!!errors.firstname}
                        aria-describedby={errors.firstname ? "help-firstname-error" : undefined}
                      />
                    </div>
                    {errors.firstname && (
                      <span id="help-firstname-error" className="help-field-error" role="alert">
                        {errors.firstname}
                      </span>
                    )}
                  </div>
                  <div className="ark-form-group help-form-group">
                    <label className="help-form-label" htmlFor="help-lastname">
                      Last Name <span className="help-required">*</span>
                    </label>
                    <div className="ark-input-wrapper">
                      <input
                        id="help-lastname"
                        name="lastname"
                        type="text"
                        placeholder="Last Name"
                        className={`ark-input HelpInput ${errors.lastname ? "ark-input-error" : ""}`}
                        value={formData.lastname}
                        onChange={(e) => handleChange("lastname", e.target.value)}
                        autoComplete="family-name"
                        aria-invalid={!!errors.lastname}
                        aria-describedby={errors.lastname ? "help-lastname-error" : undefined}
                      />
                    </div>
                    {errors.lastname && (
                      <span id="help-lastname-error" className="help-field-error" role="alert">
                        {errors.lastname}
                      </span>
                    )}
                  </div>
                </div>
                <div className="">
                  <div className="ark-form-group help-form-group">
                    <label className="help-form-label" htmlFor="help-email">
                      Email Address <span className="help-required">*</span>
                    </label>
                    <div className="ark-input-wrapper">
                      <input
                        id="help-email"
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        className={`ark-input HelpInput`}
                        value={user?.email}
                        disabled
                      // onChange={(e) => handleChange("email", e.target.value)}
                      // autoComplete="email"
                      // aria-invalid={!!errors.email}
                      // aria-describedby={errors.email ? "help-email-error" : undefined}
                      />
                    </div>
                    {errors.email && (
                      <span id="help-email-error" className="help-field-error" role="alert">
                        {errors.email}
                      </span>
                    )}
                  </div>
                  <div className="ark-form-group help-form-group">
                    <label className="help-form-label" htmlFor="help-phone">
                      Phone Number <span className="help-required">*</span>
                    </label>
                    <div className="ark-phone-input-wrapper">
                      <div className="ark-phone-country-code">
                        <CountryCodeSelector
                          value={formData.countryCode}
                          onChange={(code) => {
                            setFormData((prev) => ({ ...prev, countryCode: code, phone: "" }));
                            setErrors((prev) => ({ ...prev, phoneno: null }));
                          }}
                          className="country-code-selector"
                        />
                      </div>
                      <div className="ark-phone-number-input">
                        <div className="ark-input-wrapper">
                          <div className="ark-input-icon">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <input
                            id="help-phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            placeholder={`Enter ${phoneMaxLength}-digit number`}
                            className={`ark-input HelpInput ${errors.phoneno ? "ark-input-error" : ""}`}
                            value={formData.phone}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, phoneMaxLength);
                              handleChange("phone", value);
                            }}
                            maxLength={phoneMaxLength}
                            aria-invalid={!!errors.phoneno}
                            aria-describedby={errors.phoneno ? "help-phoneno-error" : undefined}
                            style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
                          />
                        </div>
                      </div>
                    </div>
                    {errors.phoneno && (
                      <span id="help-phoneno-error" className="help-field-error" role="alert">
                        {errors.phoneno}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ark-form-group help-form-group">
                  <label className="help-form-label" htmlFor="help-note">
                    How Can We Help? <span className="help-required">*</span>
                  </label>
                  <div className="ark-input-wrapper">
                    <textarea
                      id="help-note"
                      name="note"
                      placeholder="Describe your issue or question (min 10 characters)"
                      className={`ark-input HelpInput ${errors.note ? "ark-input-error" : ""}`}
                      value={formData.note}
                      onChange={(e) => handleChange("note", e.target.value)}
                      rows={4}
                      maxLength={2000}
                      aria-invalid={!!errors.note}
                      aria-describedby={errors.note ? "help-note-error" : undefined}
                    />
                  </div>
                  {errors.note && (
                    <span id="help-note-error" className="help-field-error" role="alert">
                      {errors.note}
                    </span>
                  )}
                </div>
                <div
                  className="ark-form-group"
                  style={{ marginBottom: "var(--ark-space-lg)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <label
                      className={`ark-checkbox-wrapper ${errors.agreeToContact ? "help-checkbox-error" : ""}`}
                      style={{ margin: 0 }}
                    >
                      <input
                        type="checkbox"
                        className="ark-checkbox"
                        checked={formData.agreeToContact}
                        onChange={(e) => handleChange("agreeToContact", e.target.checked)}
                        aria-invalid={!!errors.agreeToContact}
                      />
                      <span className="ark-checkbox-label">
                        I Agree To Be Contacted By M5dex Support For Issue Resolution. <span className="help-required">*</span>
                      </span>
                    </label>
                  </div>
                  {errors.agreeToContact && (
                    <span className="help-field-error" role="alert">
                      {errors.agreeToContact}
                    </span>
                  )}
                </div>
                <div>
                  <button
                    type="submit"
                    className="ark-btn ark-btn-primary"
                    style={{ width: "100%" }}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            </div>

            <div className="ArkSupport">
              <div>
                <div className="HelpSupportMain">
                  <h4 className="HelpSupportTitle">
                    Get In Touch With M5dex Support
                  </h4>
                  <p className="HelpDescription">
                    Have Questions Or Need Help With Your Account Or Trading?
                    Our Support Team Is Ready To Assist You.
                  </p>
                </div>
                <div className="HelpInfoColumn">
                  <div className="HelpInfoRow">
                    <div className="HelpInfoIcon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={30}
                        height={30}
                        viewBox="0 0 30 30"
                        fill="none"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M23.6429 7C24.9452 7 26 8.04878 26 9.34148V20.6585C26 21.9512 24.9452 23 23.6429 23H6.35714C5.05482 23 4 21.9512 4 20.6585V9.34148C4 8.04878 5.05482 7 6.35714 7H23.6429ZM23.7116 8.56391C23.689 8.56196 23.6664 8.56098 23.6429 8.56098H6.35714C6.33357 8.56098 6.31098 8.56196 6.28839 8.56391L14.5571 14.1777C14.8243 14.3592 15.1759 14.3592 15.443 14.1777L23.7116 8.56391ZM5.57154 9.96783V20.6587C5.57154 21.09 5.92314 21.4392 6.35725 21.4392H23.643C24.0771 21.4392 24.4287 21.09 24.4287 20.6587V9.96783L16.3299 15.4665C15.5285 16.0109 14.4717 16.0109 13.6703 15.4665L5.57154 9.96783Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="HelpInfoText">
                      <p className="HelpInfoLabel">Support Email</p>
                      <div className="HelpInfo">
                        <span className="HelpInfoValue">
                          support@m5dex.com
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="HelpInfoRow">
                    <div className="HelpInfoIcon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={30}
                        height={30}
                        viewBox="0 0 30 30"
                        fill="none"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M23 5.4C23 4.7632 22.7472 4.1528 22.2968 3.7032C21.8472 3.2528 21.2368 3 20.6 3C17.8296 3 12.1704 3 9.4 3C8.7632 3 8.1528 3.2528 7.7032 3.7032C7.2528 4.1528 7 4.7632 7 5.4C7 9.5232 7 20.4768 7 24.6C7 25.2368 7.2528 25.8472 7.7032 26.2968C8.1528 26.7472 8.7632 27 9.4 27C12.1704 27 17.8296 27 20.6 27C21.2368 27 21.8472 26.7472 22.2968 26.2968C22.7472 25.8472 23 25.2368 23 24.6V5.4ZM11.2232 4.6H9.4C9.188 4.6 8.984 4.684 8.8344 4.8344C8.684 4.984 8.6 5.188 8.6 5.4V24.6C8.6 24.812 8.684 25.016 8.8344 25.1656C8.984 25.316 9.188 25.4 9.4 25.4H20.6C20.812 25.4 21.016 25.316 21.1656 25.1656C21.316 25.016 21.4 24.812 21.4 24.6V5.4C21.4 5.188 21.316 4.984 21.1656 4.8344C21.016 4.684 20.812 4.6 20.6 4.6H18.7768L18.3416 5.9056C18.1232 6.5592 17.512 7 16.8232 7H13.1768C12.488 7 11.8768 6.5592 11.6584 5.9056L11.2232 4.6ZM14.2 24.6H15.8C16.2416 24.6 16.6 24.2416 16.6 23.8C16.6 23.3584 16.2416 23 15.8 23H14.2C13.7584 23 13.4 23.3584 13.4 23.8C13.4 24.2416 13.7584 24.6 14.2 24.6ZM12.9096 4.6L13.1768 5.4H16.8232L17.0904 4.6H12.9096Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="HelpInfoText">
                      <p className="HelpInfoLabel">Phone/WhatsApp</p>
                      <div className="HelpInfo">
                        <span className="HelpInfoValue">+91 XXXXX XXXXX</span>
                      </div>
                    </div>
                  </div>
                  <div className="HelpInfoRow">
                    <div className="HelpInfoIcon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={30}
                        height={30}
                        viewBox="0 0 30 30"
                        fill="none"
                      >
                        <path
                          d="M14.9938 4C8.93169 4 4 8.93442 4 15C4 21.0656 8.93169 26 14.9938 26C21.0628 26 26 21.0656 26 15C26 8.93442 21.0628 4 14.9938 4ZM14.9938 24.2061C9.92225 24.2061 5.79493 20.0757 5.79493 15C5.79493 9.92428 9.92046 5.79392 14.9938 5.79392C20.0723 5.79392 24.2051 9.92428 24.2051 15C24.2051 20.0757 20.0742 24.2061 14.9938 24.2061ZM19.1892 15C19.1892 15.4959 18.7879 15.897 18.2917 15.897H14.9938C14.4976 15.897 14.0963 15.4959 14.0963 15V9.17229C14.0963 8.67637 14.4976 8.27533 14.9938 8.27533C15.49 8.27533 15.8913 8.67817 15.8913 9.17229V14.103H18.2917C18.7879 14.103 19.1892 14.5041 19.1892 15Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="HelpInfoText">
                      <p className="HelpInfoLabel">Support Hours</p>
                      <div className="HelpInfo">
                        <span className="HelpInfoValue">
                          24/7 Customer Support
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="HelpInfoRow">
                    <div className="HelpInfoIcon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width={30}
                        height={30}
                        viewBox="0 0 30 30"
                        fill="none"
                      >
                        <path
                          d="M8.28571 25.2C8.05839 25.2 7.84037 25.1097 7.67962 24.9489C7.51888 24.7882 7.42857 24.5702 7.42857 24.3429V20.2C6.46054 20.0024 5.59052 19.4764 4.96574 18.7111C4.34096 17.9457 3.9998 16.988 4 16V8.28571C4 7.14907 4.45153 6.05898 5.25526 5.25526C6.05898 4.45153 7.14907 4 8.28571 4H21.7143C22.8509 4 23.941 4.45153 24.7447 5.25526C25.5485 6.05898 26 7.14907 26 8.28571V16C26 16.5628 25.8891 17.1201 25.6738 17.6401C25.4584 18.16 25.1427 18.6325 24.7447 19.0305C24.3468 19.4284 23.8743 19.7441 23.3544 19.9595C22.8344 20.1749 22.2771 20.2857 21.7143 20.2857H13.5L8.89429 24.9457C8.81466 25.0262 8.71989 25.0901 8.61544 25.1337C8.51098 25.1774 8.39892 25.1999 8.28571 25.2ZM8.28571 5.71429C7.60373 5.71429 6.94968 5.9852 6.46744 6.46744C5.9852 6.94968 5.71429 7.60373 5.71429 8.28571V16C5.71429 16.682 5.9852 17.336 6.46744 17.8183C6.94968 18.3005 7.60373 18.5714 8.28571 18.5714C8.51304 18.5714 8.73106 18.6617 8.89181 18.8225C9.05255 18.9832 9.14286 19.2012 9.14286 19.4286V22.2571L12.5343 18.8286C12.6137 18.7476 12.7083 18.6831 12.8128 18.639C12.9173 18.5949 13.0295 18.5719 13.1429 18.5714H21.7143C22.3963 18.5714 23.0503 18.3005 23.5326 17.8183C24.0148 17.336 24.2857 16.682 24.2857 16V8.28571C24.2857 7.60373 24.0148 6.94968 23.5326 6.46744C23.0503 5.9852 22.3963 5.71429 21.7143 5.71429H8.28571Z"
                          fill="currentColor"
                        />
                        <path
                          d="M10.2857 12.8569C10.1162 12.8569 9.95049 12.8066 9.80953 12.7124C9.66857 12.6182 9.55871 12.4844 9.49384 12.3277C9.42896 12.1711 9.41199 11.9988 9.44506 11.8325C9.47813 11.6662 9.55977 11.5135 9.67964 11.3936C9.79951 11.2738 9.95224 11.1921 10.1185 11.159C10.2848 11.126 10.4571 11.1429 10.6137 11.2078C10.7704 11.2727 10.9042 11.3826 10.9984 11.5235C11.0926 11.6645 11.1429 11.8302 11.1429 11.9997C11.1429 12.227 11.0526 12.4451 10.8918 12.6058C10.7311 12.7666 10.5131 12.8569 10.2857 12.8569Z"
                          fill="currentColor"
                        />
                        <path
                          d="M15.1429 12.8569C14.9734 12.8569 14.8077 12.8066 14.6667 12.7124C14.5258 12.6182 14.4159 12.4844 14.351 12.3277C14.2861 12.1711 14.2692 11.9988 14.3022 11.8325C14.3353 11.6662 14.4169 11.5135 14.5368 11.3936C14.6567 11.2738 14.8094 11.1921 14.9757 11.159C15.142 11.126 15.3143 11.1429 15.4709 11.2078C15.6275 11.2727 15.7614 11.3826 15.8556 11.5235C15.9498 11.6645 16.0001 11.8302 16.0001 11.9997C16.0001 12.227 15.9097 12.4451 15.749 12.6058C15.5883 12.7666 15.3702 12.8569 15.1429 12.8569Z"
                          fill="currentColor"
                        />
                        <path
                          d="M20 12.8569C19.8304 12.8569 19.6647 12.8066 19.5238 12.7124C19.3828 12.6182 19.2729 12.4844 19.2081 12.3277C19.1432 12.1711 19.1262 11.9988 19.1593 11.8325C19.1924 11.6662 19.274 11.5135 19.3939 11.3936C19.5137 11.2738 19.6665 11.1921 19.8327 11.159C19.999 11.126 20.1714 11.1429 20.328 11.2078C20.4846 11.2727 20.6185 11.3826 20.7127 11.5235C20.8068 11.6645 20.8571 11.8302 20.8571 11.9997C20.8571 12.227 20.7668 12.4451 20.6061 12.6058C20.4453 12.7666 20.2273 12.8569 20 12.8569Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div className="HelpInfoText">
                      <p className="HelpInfoLabel">
                        Live Chat Inside Dashboard
                      </p>
                      <div className="HelpInfo">
                        <span className="HelpInfoValue">
                          24/7 Customer Support
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="HelpSupportFaq">
            <div className="FaqHeading">
              <h2 className="HelpHeader">Frequently Asked Questions</h2>
              <p className="HelpDescription">(FAQ)</p>
            </div>
            <div className="faq-list">
              {faqData.map((item, index) => (
                <div
                  key={index}
                  className={`faq-item ${activeIndex === index ? "active" : ""}`}
                >
                  <button
                    className="faq-question"
                    onClick={() => toggleFAQ(index)}
                  >
                    <span>
                      <strong>Q{index + 1}.</strong> {item.question}
                    </span>
                    <span className="icon">
                      {activeIndex === index ? "−" : "+"}
                    </span>
                  </button>

                  {activeIndex === index && (
                    <div className="faq-answer">
                      {item.paragraphs.map((paragraph, pIndex) => (
                        <p key={pIndex} className="faq-answer-paragraph">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpSupport;
