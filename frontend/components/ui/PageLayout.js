import Head from "next/head";
import Logo from "../Logo";

export const SITE_NAME = "Nabad";
export const SITE_TITLE = "Nabad: know where to go when it matters";
export const SITE_DESCRIPTION =
  "Tell Nabad how you feel. It helps you understand how urgent it is and find a hospital that can treat you.";
// Social sites need a full URL for the preview image, so it points at the official site.
export const SITE_URL = "https://nabad-psi.vercel.app";
// Where people reach the team (the Contact page). A placeholder until the team picks a shared inbox.
export const CONTACT_EMAIL = "nabad.team3@example.com";

// "Log in" -> "Log in · Nabad". Without a title (the landing page) the tab shows the site title.
export function pageTitle(title) {
  return title ? `${title} · ${SITE_NAME}` : SITE_TITLE;
}

// The frame of every page: a header, then the content in a centered column with side margins
// that grow on bigger screens. The text inside stays left-aligned.
//   title:  the browser tab title, e.g. "Log in" (shown as "Log in · Nabad"). Leave it out only on the landing page.
//   header: what goes in the top bar. Defaults to the logo alone; signed-in pages pass <ProfileHeader />.
//   width:  "content" (46rem, most pages) or "wide" (68rem, the landing page).
//   footer: optional page-specific note, shown above the site footer that every page gets.
export default function PageLayout({ title, header, width = "content", footer, children }) {
  const container = width === "wide" ? "container container--wide" : "container";
  const fullTitle = pageTitle(title);
  return (
    <div className="page-shell">
      {/* The key props stop Next.js from repeating a tag when a page adds its own. */}
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={SITE_DESCRIPTION} key="description" />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:site_name" content={SITE_NAME} key="og:site_name" />
        <meta property="og:title" content={fullTitle} key="og:title" />
        <meta property="og:description" content={SITE_DESCRIPTION} key="og:description" />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} key="og:image" />
        <meta property="og:image:width" content="1200" key="og:image:width" />
        <meta property="og:image:height" content="630" key="og:image:height" />
        <meta property="og:image:alt" content="The Nabad logo: a pulse line in a rounded teal square" key="og:image:alt" />
        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
      </Head>
      <a href="#main" className="skip-link">Skip to main content</a>
      {header === undefined ? <SiteHeader width={width} /> : header}
      <main id="main" className={`${container} page-main`}>
        {children}
      </main>
      {footer && <div className={`${container} page-note`}>{footer}</div>}
      <SiteFooter width={width} />
    </div>
  );
}

// The bottom of every page: the legal and contact links, the medical disclaimer and who made Nabad.
export function SiteFooter({ width = "content" }) {
  const container = width === "wide" ? "container container--wide" : "container";
  return (
    <footer className="site-footer">
      <div className={`${container} site-footer__inner`}>
        <nav aria-label="Footer">
          <ul className="site-footer__links">
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms of Use</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
        <p className="site-footer__disclaimer">
          Nabad gives guidance, not a diagnosis. In an emergency, call <a href="tel:140">140</a>.
        </p>
        <p>© 2026 Nabad</p>
        <p className="site-footer__credit">Built by Team 3 for CMPS 271 at the American University of Beirut.</p>
      </div>
    </footer>
  );
}

// The top bar: the logo on the left, anything passed as children on the right.
export function SiteHeader({ width = "content", children }) {
  const container = width === "wide" ? "container container--wide" : "container";
  return (
    <header className="site-header">
      <div className={`${container} site-header__inner`}>
        <Logo />
        {children && <nav aria-label="Main" className="site-nav">{children}</nav>}
      </div>
    </header>
  );
}
