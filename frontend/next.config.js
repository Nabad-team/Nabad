// The browser only ever talks to this site: /api/* is forwarded to the backend.
// Keeping the API on the same site as the pages lets the login cookie (SameSite=Lax) work
// even though the backend is hosted on a different domain.
// BACKEND_URL is the backend origin without /api, e.g. https://nabad-backend.onrender.com.
// Rewrites are fixed at build time, so redeploy after changing it.
const backendUrl = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

if (process.env.VERCEL && !process.env.BACKEND_URL) {
  console.warn("BACKEND_URL is not set: /api requests will not reach the backend.");
}

module.exports = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};
