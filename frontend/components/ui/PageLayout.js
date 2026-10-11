import Head from "next/head";
import Logo from "../Logo";

// The frame of every page: a header, then the content in a centered column with side margins
// that grow on bigger screens. The text inside stays left-aligned.
//   header: what goes in the top bar. Defaults to the logo alone; signed-in pages pass <ProfileHeader />.
//   width:  "content" (46rem, most pages) or "wide" (68rem, the landing page).
//   footer: optional content for the bottom of the page.
export default function PageLayout({ header, width = "content", footer, children }) {
  const container = width === "wide" ? "container container--wide" : "container";
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <a href="#main" className="skip-link">Skip to main content</a>
      {header === undefined ? <SiteHeader width={width} /> : header}
      <main id="main" className={`${container} page-main`}>
        {children}
      </main>
      {footer && (
        <footer className="site-footer">
          <div className={container}>{footer}</div>
        </footer>
      )}
    </>
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
