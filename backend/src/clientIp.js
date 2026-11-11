// Who is calling? Sets req.clientIp, which every per-IP rate limit uses (rateLimit.js). No header that a visitor can
// send is trusted on its own: in front of the API sit Vercel, Cloudflare and Render's own proxies, and a visitor can
// push fake X-Forwarded-For and X-Vercel-Forwarded-For values through Vercel (docs/environments.md, "Client IP").
//
// 1. Through our Next.js app (frontend/proxy.js): the proxy sends API_PROXY_SECRET in X-Nabad-Proxy-Secret and the
//    visitor's IP, as Vercel determined it, in X-Nabad-Client-IP. Only with the right secret is that IP believed.
// 2. Anything else, while API_PROXY_REQUIRED is not "true" (rolling out): Cloudflare's CF-Connecting-IP on staging and
//    production (Cloudflare overwrites it, so it can't be spoofed, though for requests via Vercel it is Vercel's
//    address, shared by many visitors), the socket address locally.
// 3. With API_PROXY_REQUIRED=true, anything without the right secret gets 403, except Render's health checks.
const crypto = require("node:crypto");
const net = require("node:net");

const SECRET_HEADER = "x-nabad-proxy-secret";
const CLIENT_IP_HEADER = "x-nabad-client-ip";
const HEALTH_CHECKS = new Set(["/api/health", "/api/health/ready"]);

function normalizeIp(value) {
  if (typeof value !== "string") return null;
  const ip = value.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "").toLowerCase();
  return net.isIP(ip) ? ip : null;
}

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();
function secretMatches(provided, secret) {
  return typeof provided === "string" && Boolean(secret) && crypto.timingSafeEqual(digest(provided), digest(secret));
}

function clientIp({ secret, required = false, hosted = false }) {
  return (req, res, next) => {
    if (secretMatches(req.get(SECRET_HEADER), secret)) {
      const ip = normalizeIp(req.get(CLIENT_IP_HEADER));
      if (!ip) return res.status(400).json({ error: "Bad request." });
      req.clientIp = ip;
      req.viaAppProxy = true;
      return next();
    }
    if (required && !(["GET", "HEAD"].includes(req.method) && HEALTH_CHECKS.has(req.path))) {
      return res.status(403).json({ error: "Please use the Nabad app." });
    }
    req.clientIp = (hosted && normalizeIp(req.get("cf-connecting-ip"))) || normalizeIp(req.socket?.remoteAddress) || "unknown";
    req.viaAppProxy = false;
    return next();
  };
}

module.exports = { clientIp, normalizeIp, secretMatches, SECRET_HEADER, CLIENT_IP_HEADER, HEALTH_CHECKS };
