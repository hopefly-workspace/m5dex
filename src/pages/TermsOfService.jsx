import { Link } from "react-router-dom";
import Header from "../components/Header";
import {
  TERMS_META,
  TERMS_INTRO,
  TERMS_SECTIONS,
} from "../content/termsOfService";
import "../styles/pages/TermsOfService.css";

const resolveParagraphs = (section, meta) => {
  if (typeof section.paragraphs === "function") {
    return section.paragraphs(meta);
  }
  return section.paragraphs ?? [];
};

const TermsOfService = () => {
  return (
    <>
      {/* <Header /> */}
      <div className="terms-page">
        <article className="terms-container">
          <header className="terms-hero">
            <p className="terms-eyebrow">Legal</p>
            <h1 className="terms-title">Terms of Service</h1>
            <dl className="terms-meta">
              <div className="terms-meta-item">
                <dt>Effective date</dt>
                <dd>{TERMS_META.effectiveDate}</dd>
              </div>
              <div className="terms-meta-item">
                <dt>Website</dt>
                <dd>
                  <a
                    href={TERMS_META.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="terms-link"
                  >
                    {TERMS_META.websiteLabel}
                  </a>
                </dd>
              </div>
              <div className="terms-meta-item">
                <dt>Platform</dt>
                <dd>{TERMS_META.platformName}</dd>
              </div>
            </dl>
          </header>

          <div className="terms-intro">
            {TERMS_INTRO.map((paragraph, index) => (
              <p key={index} className="terms-paragraph">
                {paragraph}
              </p>
            ))}
          </div>

          <nav className="terms-toc" aria-label="Table of contents">
            <h2 className="terms-toc-title">Contents</h2>
            <ol className="terms-toc-list">
              {TERMS_SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#terms-${section.id}`} className="terms-toc-link">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="terms-sections">
            {TERMS_SECTIONS.map((section, index) => (
              <section
                key={section.id}
                id={`terms-${section.id}`}
                className="terms-section"
              >
                <h2 className="terms-section-title">
                  <span className="terms-section-num">{index + 1}.</span>
                  {section.title}
                </h2>
                {resolveParagraphs(section, TERMS_META).map((paragraph, pIndex) => (
                  <p key={pIndex} className="terms-paragraph">
                    {paragraph}
                  </p>
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
                {section.footerParagraph && (
                  <p className="terms-paragraph">
                    {section.footerParagraph(TERMS_META)}
                  </p>
                )}
              </section>
            ))}
          </div>

          <footer className="terms-footer">
            <p className="terms-paragraph terms-footer-note">
              Questions about these Terms? Contact us at{" "}
              <a href={`mailto:${TERMS_META.supportEmail}`} className="terms-link">
                {TERMS_META.supportEmail}
              </a>
              . See also our{" "}
              <Link to="/data-policy" className="terms-link">
                Privacy Policy
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

export default TermsOfService;
