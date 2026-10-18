import { Html, Head, Main, NextScript } from "next/document";

// The site's teal (--color-primary in styles/tokens.css): the browser bar color on phones.
export const THEME_COLOR = "#0f766e";

// The <html> and <body> tags around every page. Only things that never change per page go here,
// like the icons (made by scripts/generate-icons.js); titles and meta tags are set by PageLayout
// (components/ui/PageLayout.js).
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content={THEME_COLOR} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
