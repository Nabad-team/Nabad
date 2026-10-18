// Writes the PNG icons in public/ from the Nabad logo (public/favicon.svg, same drawing as components/Logo.js):
//   favicon-32x32.png      the browser tab icon for browsers that don't use the SVG favicon
//   apple-touch-icon.png   180x180, used when the site is added to an iPhone or iPad home screen
//   icon-192.png, icon-512.png   the app icons listed in public/site.webmanifest
// Home screen icons get a solid background (iOS fills transparent corners with black) and some padding,
// because phones crop their own rounded shape out of the square.
// Run with: node frontend/scripts/generate-icons.js
const path = require("path");
const sharp = require("sharp");

const LOGO = `<rect x="1" y="1" width="30" height="30" rx="8" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/>
  <polyline points="5,17 11,17 13,14 15,17 17,7 20,25 22,17 27,17" fill="none" stroke="#0f766e"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

// The logo alone on a transparent square, for the browser tab.
const tabIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  ${LOGO}
</svg>`;

// The logo at 80% of the square, centered on the light teal of its own background.
const homeScreenIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
  <rect width="40" height="40" fill="#f0fdfa"/>
  <g transform="translate(4 4)">${LOGO}</g>
</svg>`;

const icons = [
  ["favicon-32x32.png", tabIcon(32)],
  ["apple-touch-icon.png", homeScreenIcon(180)],
  ["icon-192.png", homeScreenIcon(192)],
  ["icon-512.png", homeScreenIcon(512)],
];

Promise.all(
  icons.map(([file, svg]) =>
    sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(__dirname, "../public", file))
      .then(() => console.log(`Wrote public/${file}`))
  )
);
