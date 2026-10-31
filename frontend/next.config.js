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

// Error tracking (lib/sentry.js) is on only when NEXT_PUBLIC_SENTRY_DSN is set. The browser then sends error reports
// to the DSN's ingest host, e.g. https://o123.ingest.de.sentry.io, and the Content-Security-Policy allows that one
// origin and nothing else of Sentry's.
const sentryDsn = (process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
function sentryIngestOrigin(dsn) {
  if (!dsn) return null;
  let url;
  try { url = new URL(dsn); } catch { throw new Error("NEXT_PUBLIC_SENTRY_DSN is not a valid Sentry DSN (https://<key>@<host>/<project>)."); }
  if (url.protocol !== "https:" && process.env.VERCEL) throw new Error("NEXT_PUBLIC_SENTRY_DSN must use https.");
  return url.origin;
}
const sentryIngest = sentryIngestOrigin(sentryDsn);

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
  `connect-src 'self'${sentryIngest ? ` ${sentryIngest}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Same-origin microphone/location remain browser-permission gated. The document policy must
// allow location across client-side navigation into symptom alerts and the care directory.
const permissionsPolicy = (geolocation) => `camera=(), microphone=(self), geolocation=${geolocation}`;

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy("(self)") },
];

const nextConfig = {
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

// Only with a DSN: Sentry's build step then prepares the built files so the SDK can read stack traces. Its own
// telemetry is off, it adds no instrumentation (lib/sentry.js only catches errors), and source maps are uploaded
// only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set (readable stack traces); otherwise none are.
module.exports = sentryDsn
  ? require("@sentry/nextjs/config").withSentryConfig(nextConfig, {
    telemetry: false,
    silent: !process.env.CI,
    buildTimeInstrumentation: false,
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  })
  : nextConfig;
