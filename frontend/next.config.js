// The browser only ever talks to this site: /api/* is forwarded to the backend.
// Keeping the API on the same site as the pages lets the login cookie (SameSite=Lax) work
// even though the backend is hosted on a different domain.
// BACKEND_URL is the backend origin without /api, e.g. https://nabad-backend-nhv5.onrender.com.
// Rewrites are fixed at build time, so redeploy after changing it.
// Production must not build half-configured: without BACKEND_URL every /api request would fail.
if (process.env.VERCEL_ENV === "production" && !process.env.BACKEND_URL?.trim()) {
  throw new Error("Missing required environment variable: BACKEND_URL (the backend origin without /api).");
}
if (process.env.VERCEL && !process.env.BACKEND_URL) {
  console.warn("BACKEND_URL is not set: /api requests will not reach the backend.");
}
const backendUrl = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

// Security headers on every response. The Content-Security-Policy only allows what the app really loads:
// its own scripts, styles, fonts (next/font serves them from this site) and API, profile pictures (data: URLs)
// and the OpenStreetMap tiles of the provider map. Next.js and styled-jsx add small inline scripts and
// styles, and Leaflet positions the map with inline styles, hence 'unsafe-inline'. `next dev` also
// needs 'unsafe-eval'. Google sign-in is a full-page redirect through /api/auth/google, so it needs nothing here.
const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// The microphone is for voice input on the symptom check. Location is only allowed on the providers page
// ("near me"); the rule for /providers comes last so it replaces the site-wide one.
const permissionsPolicy = (geolocation) => `camera=(), microphone=(self), geolocation=${geolocation}`;

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy("()") },
];

module.exports = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/providers", headers: [{ key: "Permissions-Policy", value: permissionsPolicy("(self)") }] },
    ];
  },
  // Only the Docker image (frontend/Dockerfile) sets NEXT_STANDALONE: it runs Next's small standalone server.
  // Vercel builds are unchanged.
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {}),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};
