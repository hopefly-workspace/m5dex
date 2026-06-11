import { Link } from "react-router-dom";
import Header from "../components/Header";
import {
  PRIVACY_META,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
} from "../content/dataProtectionPolicy";
import "../styles/pages/TermsOfService.css";

const resolveParagraphs = (section, meta) => {
  if (typeof section.paragraphs === "function") {
    return section.paragraphs(meta);
  }
  return section.paragraphs ?? [];
};

const LegalSubsection = ({ subsection }) => (
  <div className="terms-subsection">
    <h3 className="terms-subsection-title">{subsection.title}</h3>
    {(subsection.paragraphs ?? []).map((paragraph, index) => (
      <p key={index} className="terms-paragraph">
        {paragraph}
      </p>
    ))}
    {subsection.list && (
      <ul className="terms-list">
        {subsection.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )}
  </div>
);

const ContactCard = ({ meta }) => (
  <dl className="terms-contact-card">
    <div className="terms-contact-row">
      <dt>Company name</dt>
      <dd>{meta.companyName}</dd>
    </div>
    <div className="terms-contact-row">
      <dt>Website</dt>
      <dd>
        <a href={meta.website} target="_blank" rel="noopener noreferrer" className="terms-link">
          {meta.websiteLabel}
        </a>
      </dd>
    </div>
    <div className="terms-contact-row">
      <dt>Support email</dt>
      <dd>
        <a href={`mailto:${meta.supportEmail}`} className="terms-link">
          {meta.supportEmail}
        </a>
      </dd>
    </div>
    <div className="terms-contact-row">
      <dt>Privacy / grievance email</dt>
      <dd>
        <a href={`mailto:${meta.privacyEmail}`} className="terms-link">
          {meta.privacyEmail}
        </a>
      </dd>
    </div>
    {/* <div className="terms-contact-row">
      <dt>Phone</dt>
      <dd>{meta.phone}</dd>
    </div> */}
    <div className="terms-contact-row">
      <dt>Address</dt>
      <dd>{meta.address}</dd>
    </div>
  </dl>
);

const DataProtectionPolicy = () => {
  const pagePrefix = "data-policy";

  return (
    <>
      {/* <Header /> */}
      <div className="terms-page">
        <article className="terms-container">
          <header className="terms-hero">
            <p className="terms-eyebrow">Legal</p>
            <h1 className="terms-title">Privacy Policy</h1>
            <dl className="terms-meta">
              <div className="terms-meta-item">
                <dt>Effective date</dt>
                <dd>{PRIVACY_META.effectiveDate}</dd>
              </div>
              <div className="terms-meta-item">
                <dt>Website</dt>
                <dd>
                  <a
                    href={PRIVACY_META.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="terms-link"
                  >
                    {PRIVACY_META.websiteLabel}
                  </a>
                </dd>
              </div>
              <div className="terms-meta-item">
                <dt>Platform</dt>
                <dd>{PRIVACY_META.platformName}</dd>
              </div>
            </dl>
          </header>

          <div className="terms-intro">
            {PRIVACY_INTRO.map((paragraph, index) => (
              <p key={index} className="terms-paragraph">
                {paragraph}
              </p>
            ))}
          </div>

          <nav className="terms-toc" aria-label="Table of contents">
            <h2 className="terms-toc-title">Contents</h2>
            <ol className="terms-toc-list">
              {PRIVACY_SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${pagePrefix}-${section.id}`} className="terms-toc-link">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="terms-sections">
            {PRIVACY_SECTIONS.map((section, index) => (
              <section
                key={section.id}
                id={`${pagePrefix}-${section.id}`}
                className="terms-section"
              >
                <h2 className="terms-section-title">
                  <span className="terms-section-num">{index + 1}.</span>
                  {section.title}
                </h2>
                {resolveParagraphs(section, PRIVACY_META).map((paragraph, pIndex) => (
                  <p key={pIndex} className="terms-paragraph">
                    {paragraph}
                  </p>
                ))}
                {section.subsections?.map((subsection) => (
                  <LegalSubsection key={subsection.title} subsection={subsection} />
                ))}
                {section.list && (
                  <ul className="terms-list">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.closingParagraph && (
                  <p className="terms-paragraph">{section.closingParagraph}</p>
                )}
                {section.showContact && <ContactCard meta={PRIVACY_META} />}
              </section>
            ))}
          </div>

          <footer className="terms-footer">
            <p className="terms-paragraph terms-footer-note">
              See also our{" "}
              <Link to="/terms" className="terms-link">
                Terms of Service
              </Link>
              .
            </p>
            <Link to="/signup" className="terms-back-link">
              ← Back to sign up
            </Link>
          </footer>
        </article>
      </div>
    </>
  );
};

export default DataProtectionPolicy;
