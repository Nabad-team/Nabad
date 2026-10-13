import { Html, Head, Main, NextScript } from "next/document";


// The <html> and <body> tags around every page. Only things that never change per page go here;
// titles and meta tags are set by PageLayout (components/ui/PageLayout.js).
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
