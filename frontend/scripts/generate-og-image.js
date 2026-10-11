// Writes public/og-image.png, the preview picture shown when a Nabad link is shared (Open Graph).
// Social sites don't show SVG previews, so the logo is drawn here and saved as a 1200x630 PNG.
// Run with: node frontend/scripts/generate-og-image.js
const path = require("path");
const sharp = require("sharp");

// Same drawing and colors as components/Logo.js, on the page background from styles/tokens.css.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#faf6ef"/>
  <g transform="translate(300 195) scale(7.5)">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/>
    <polyline points="5,17 11,17 13,14 15,17 17,7 20,25 22,17 27,17" fill="none" stroke="#0f766e"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="580" y="365" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="120" font-weight="bold" fill="#0f766e">Nabad</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(__dirname, "../public/og-image.png"))
  .then(() => console.log("Wrote public/og-image.png"));
