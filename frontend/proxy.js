// Runs before every /api request is forwarded to the backend (the rewrite in next.config.js). It tells the API who the
// visitor is, in a way the visitor can't fake (docs/environments.md, "Client IP"):
// - removes any X-Nabad-Proxy-Secret or X-Nabad-Client-IP the visitor sent;
// - sends the visitor's IP as Vercel determined it (x-real-ip, the same header @vercel/functions' ipAddress() reads),
//   together with API_PROXY_SECRET, which the API checks before it believes that IP.
// Without API_PROXY_SECRET (local development, Docker Compose) it only removes those two headers.
import { NextResponse } from "next/server";

export const SECRET_HEADER = "x-nabad-proxy-secret";
export const CLIENT_IP_HEADER = "x-nabad-client-ip";
const VERCEL_IP_HEADER = "x-real-ip";

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;
export function validIp(value) {
  const ip = typeof value === "string" ? value.trim() : "";
  return IPV4.test(ip) || (ip.includes(":") && IPV6.test(ip)) ? ip : null;
}

export function proxy(request) {
  const headers = new Headers(request.headers);
  headers.delete(SECRET_HEADER);
  headers.delete(CLIENT_IP_HEADER);
  const secret = process.env.API_PROXY_SECRET?.trim();
  const ip = validIp(request.headers.get(VERCEL_IP_HEADER));
  if (secret && ip) {
    headers.set(SECRET_HEADER, secret);
    headers.set(CLIENT_IP_HEADER, ip);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
