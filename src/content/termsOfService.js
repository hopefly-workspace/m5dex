/**
 * Terms of Service — M5dex / m5dex.com
 * Update TERMS_META when legal copy or jurisdiction details change.
 */

export const TERMS_META = {
  effectiveDate: "March 15, 2026",
  website: "https://m5dex.com/",
  websiteLabel: "m5dex.com",
  platformName: "M5dex Dashboard / M5dex",
  supportEmail: "support@m5dex.com",
  governingLaw: "India",
  disputeVenue: "competent courts in India",
};

export const TERMS_INTRO = [
  "Welcome to M5dex. These Terms of Service govern your access to and use of our website, dashboard, trading-related services, tools, features, content, and any other services provided through m5dex.com.",
  "By creating an account, accessing the dashboard, depositing funds, using trading tools, or using any feature on our platform, you agree to these Terms. If you do not agree with these Terms, you should not use our website or services.",
];

export const TERMS_SECTIONS = [
  {
    id: "about",
    title: "About M5dex",
    paragraphs: [
      "M5dex is an online platform that provides users with access to trading-related services, market information, account management tools, dashboard features, and other services connected with Indian markets, cryptocurrency markets, forex markets, and other available financial instruments or digital assets.",
      "The availability of markets, assets, trading features, payment methods, and account services may vary depending on your location, account status, verification level, applicable laws, and platform policies.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility to Use the Platform",
    paragraphs: [
      "To use M5dex, you must be at least 18 years old and legally capable of entering into a binding agreement. By using our platform, you confirm that the information you provide is true, complete, and accurate.",
      "You must not use M5dex if you are located in a country, state, or region where trading, crypto activity, forex activity, or use of such platforms is restricted or prohibited by law.",
      "We may refuse, suspend, or terminate access to any account if we believe the user is not eligible, has provided false information, or is using the platform in violation of these Terms.",
    ],
  },
  {
    id: "registration",
    title: "Account Registration",
    paragraphs: [
      "To access certain features, you may be required to create an account. You agree to provide accurate personal details, contact information, and any required verification documents.",
      "You are responsible for keeping your login credentials confidential. Any activity performed through your account will be considered your responsibility unless proven otherwise.",
    ],
    footerParagraph: (meta) =>
      `If you believe your account has been accessed without permission, you must contact us immediately at ${meta.supportEmail}.`,
  },
  {
    id: "kyc",
    title: "Verification, KYC, and Compliance",
    paragraphs: [
      "M5dex may require identity verification, KYC documents, address proof, payment verification, or other information before allowing access to deposits, withdrawals, trading features, or certain services.",
      "We may collect and verify user information to comply with applicable laws, fraud prevention practices, anti-money laundering requirements, and platform security standards.",
      "Failure to complete verification may result in limited account access, delayed withdrawals, blocked transactions, or account suspension.",
    ],
  },
  {
    id: "risk",
    title: "Trading and Market Risk",
    paragraphs: [
      "Trading in financial markets, cryptocurrency, forex, and related instruments involves significant risk. Prices can move quickly, and you may lose part or all of your funds.",
      "M5dex does not guarantee profits, returns, accuracy of market movement, trading success, or protection from losses. Any decision to trade is made at your own risk.",
      "You understand and agree that:",
    ],
    list: [
      "Market prices may be volatile.",
      "Trading may result in financial loss.",
      "Past performance does not guarantee future results.",
      "Crypto and forex markets may carry additional risk due to volatility, liquidity, regulation, and technical issues.",
    ],
    closingParagraph: "You are responsible for understanding the risks before using the platform.",
  },
  {
    id: "advice",
    title: "No Financial or Investment Advice",
    paragraphs: [
      "Content, tools, charts, market updates, dashboard data, signals, or any information provided on M5dex are for general informational and platform-use purposes only.",
      "Nothing on the platform should be considered financial advice, investment advice, legal advice, tax advice, or a recommendation to buy, sell, hold, or trade any asset.",
      "You should make your own independent decisions and consult a qualified financial advisor if needed.",
    ],
  },
  {
    id: "deposits",
    title: "Deposits and Withdrawals",
    paragraphs: [
      "Users may deposit funds through the supported payment methods available on the platform. Deposit options, processing times, minimum amounts, fees, and availability may vary.",
      "Withdrawals may be subject to verification, security checks, payment provider processing time, bank delays, blockchain confirmation time, or compliance review.",
      "M5dex may delay, reject, or hold a deposit or withdrawal if:",
    ],
    list: [
      "The account is not verified.",
      "Suspicious activity is detected.",
      "Payment details do not match the account holder.",
      "Required documents are missing.",
      "The transaction violates platform rules or applicable law.",
      "Technical or third-party payment issues occur.",
    ],
    closingParagraph:
      "Users are responsible for entering correct deposit and withdrawal details. M5dex may not be responsible for losses caused by incorrect wallet addresses, bank details, UPI details, or payment information provided by the user.",
  },
  {
    id: "fees",
    title: "Fees and Charges",
    paragraphs: [
      "M5dex may charge fees for trading, deposits, withdrawals, conversions, account services, payment processing, or other platform features.",
      "Fees may vary depending on market type, asset type, payment method, account type, transaction size, or third-party provider charges.",
      "By using the platform, you agree to pay all applicable fees. M5dex reserves the right to update fees at any time. Updated fees may be shown on the dashboard, transaction page, or other relevant sections of the platform.",
    ],
  },
  {
    id: "responsibilities",
    title: "User Responsibilities",
    paragraphs: ["You agree to use M5dex responsibly and lawfully. You must not:"],
    list: [
      "Use the platform for illegal activities.",
      "Provide false or misleading information.",
      "Attempt to hack, damage, overload, or disrupt the platform.",
      "Use another person's account or identity.",
      "Create multiple accounts to misuse promotions or platform features.",
      "Use the platform for fraud, money laundering, market manipulation, or unauthorized transactions.",
      "Share your login details with others.",
      "Violate any applicable trading, tax, crypto, forex, securities, or financial laws.",
    ],
    closingParagraph:
      "If we detect misuse, we may restrict, suspend, or permanently close your account.",
  },
  {
    id: "market-data",
    title: "Market Data and Platform Information",
    paragraphs: [
      "M5dex may display prices, charts, market data, wallet balances, order information, or other financial information. Such data may be provided by third-party providers, exchanges, liquidity partners, APIs, or other sources.",
      "We try to provide accurate and timely information, but we do not guarantee that all data will always be complete, accurate, real-time, or error-free.",
      "You agree that M5dex will not be responsible for losses caused by delayed data, incorrect market information, technical errors, third-party API failures, or temporary platform issues.",
    ],
  },
  {
    id: "availability",
    title: "Platform Availability",
    paragraphs: [
      "We aim to keep the platform available and functional, but we do not guarantee uninterrupted access.",
      "The platform may be unavailable due to maintenance, updates, technical issues, internet failures, cyberattacks, server problems, market conditions, third-party service failures, or events beyond our control.",
      "M5dex will not be liable for losses resulting from temporary downtime, delayed execution, failed access, or service interruption.",
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    paragraphs: [
      "M5dex may use or connect with third-party services such as payment gateways, banks, liquidity providers, crypto networks, data providers, APIs, verification providers, or trading infrastructure partners.",
      "Your use of third-party services may be subject to their own terms, privacy policies, fees, and processing rules.",
      "M5dex is not responsible for the actions, delays, errors, failures, or policies of third-party service providers.",
    ],
  },
  {
    id: "suspension",
    title: "Account Suspension or Termination",
    paragraphs: ["M5dex may suspend, restrict, or terminate your account at any time if we believe:"],
    list: [
      "You violated these Terms.",
      "You provided false information.",
      "Your account is involved in suspicious activity.",
      "You failed required verification.",
      "Your use of the platform may create legal, financial, security, or reputational risk.",
      "Required by law, regulation, court order, payment provider, or compliance request.",
    ],
    closingParagraph:
      "If your account is suspended, access to deposits, withdrawals, trading features, or dashboard services may be limited until the issue is resolved.",
  },
  {
    id: "taxes",
    title: "Taxes",
    paragraphs: [
      "You are responsible for understanding and paying any taxes that may apply to your trading activity, profits, deposits, withdrawals, crypto transactions, forex activity, or other platform use.",
      "M5dex does not provide tax advice. You should consult a qualified tax professional for guidance based on your location and activity.",
    ],
  },
  {
    id: "ip",
    title: "Intellectual Property",
    paragraphs: [
      "All website content, platform design, dashboard layout, branding, logos, text, graphics, software, features, and other materials related to M5dex are owned by or licensed to M5dex.",
      "You may not copy, modify, reproduce, sell, distribute, reverse engineer, or misuse any part of the platform without written permission.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and Data Protection",
    paragraphs: [
      "Your use of M5dex is also subject to our Privacy Policy. We may collect, use, store, and process personal information for account creation, verification, security, compliance, payment processing, support, and platform improvement.",
      "You agree that M5dex may process your information as described in our Privacy Policy.",
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, M5dex and its owners, directors, employees, partners, service providers, and affiliates will not be liable for any direct, indirect, incidental, special, financial, business, or consequential loss arising from:",
    ],
    list: [
      "Trading losses.",
      "Market volatility.",
      "Account misuse.",
      "Incorrect information provided by the user.",
      "Platform downtime.",
      "Delayed deposits or withdrawals.",
      "Third-party provider issues.",
      "Cybersecurity events.",
      "Regulatory restrictions.",
      "Use or inability to use the platform.",
    ],
    closingParagraph: "You use M5dex at your own risk.",
  },
  {
    id: "no-guarantee",
    title: "No Guarantee of Profit or Performance",
    paragraphs: [
      "M5dex does not promise fixed returns, guaranteed profit, guaranteed withdrawals, guaranteed trade execution, or guaranteed market performance.",
      "Any examples, charts, numbers, market movements, or educational information shown on the platform are not promises of future results.",
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    paragraphs: [
      "You agree to protect and hold harmless M5dex, its team, partners, affiliates, and service providers from any claims, losses, damages, penalties, costs, or expenses resulting from:",
    ],
    list: [
      "Your use of the platform.",
      "Your violation of these Terms.",
      "Your violation of any law or regulation.",
      "Your misuse of trading features.",
      "Your incorrect or misleading information.",
      "Any dispute caused by your account activity.",
    ],
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    paragraphs: [
      "M5dex may update these Terms from time to time. Updated Terms will be posted on the website or dashboard with a revised effective date.",
      "By continuing to use the platform after changes are posted, you agree to the updated Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing Law and Dispute Resolution",
    paragraphs: (meta) => [
      `These Terms shall be governed by the laws of ${meta.governingLaw}, without regard to conflict of law principles.`,
      `Any disputes related to these Terms, your account, or use of the platform shall be handled through the ${meta.disputeVenue}, unless applicable law requires otherwise.`,
    ],
  },
];
