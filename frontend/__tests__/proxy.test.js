/**
 * @jest-environment node
 */
// proxy.js: the visitor's IP reaches the API only with our secret, and a visitor can't inject either header.
import { NextRequest } from "next/server";
import { proxy, config, SECRET_HEADER, CLIENT_IP_HEADER, validIp } from "../proxy";

const ORIGINAL_ENV = process.env;
const SECRET = "s".repeat(64);

// What NextResponse.next({ request: { headers } }) forwards upstream: x-middleware-request-<name> headers.
function forwarded(response) {
  const out = {};
  for (const [key, value] of response.headers) {
    if (key.startsWith("x-middleware-request-")) out[key.slice("x-middleware-request-".length)] = value;
  }
  const kept = (response.headers.get("x-middleware-override-headers") || "").split(",").filter(Boolean);
  return { headers: out, kept };
}
const request = (headers) => new NextRequest("https://nabad-staging.vercel.app/api/auth/login", { method: "POST", headers });

describe("proxy.js", () => {
  afterEach(() => { process.env = ORIGINAL_ENV; });

  test("runs on /api only", () => {
    expect(config.matcher).toBe("/api/:path*");
  });

  test("sends Vercel's visitor IP with the secret", () => {
    process.env = { ...ORIGINAL_ENV, API_PROXY_SECRET: SECRET };
    const { headers } = forwarded(proxy(request({ "x-real-ip": "212.28.230.77" })));
    expect(headers[SECRET_HEADER]).toBe(SECRET);
    expect(headers[CLIENT_IP_HEADER]).toBe("212.28.230.77");
  });

  test("a visitor can't inject the secret or the client IP", () => {
    process.env = { ...ORIGINAL_ENV, API_PROXY_SECRET: SECRET };
    const { headers } = forwarded(proxy(request({
      "x-real-ip": "212.28.230.77", [SECRET_HEADER]: "guess", [CLIENT_IP_HEADER]: "203.0.113.9",
      "x-forwarded-for": "198.51.100.1, 203.0.113.2", "x-vercel-forwarded-for": "198.51.100.3",
    })));
    expect(headers[SECRET_HEADER]).toBe(SECRET);
    expect(headers[CLIENT_IP_HEADER]).toBe("212.28.230.77");
  });

  test("without a secret (local, Docker) it only removes the visitor's copies", () => {
    process.env = { ...ORIGINAL_ENV, API_PROXY_SECRET: undefined };
    delete process.env.API_PROXY_SECRET;
    const { headers, kept } = forwarded(proxy(request({ "x-real-ip": "212.28.230.77", [SECRET_HEADER]: "guess", [CLIENT_IP_HEADER]: "203.0.113.9" })));
    expect(headers[SECRET_HEADER]).toBeUndefined();
    expect(headers[CLIENT_IP_HEADER]).toBeUndefined();
    expect(kept).not.toContain(SECRET_HEADER);
    expect(kept).not.toContain(CLIENT_IP_HEADER);
  });

  test("no usable IP from Vercel: nothing is vouched for", () => {
    process.env = { ...ORIGINAL_ENV, API_PROXY_SECRET: SECRET };
    for (const value of [undefined, "", "not-an-ip", "1.2.3.4, 5.6.7.8", "999.1.1.1"]) {
      const { headers } = forwarded(proxy(request(value === undefined ? {} : { "x-real-ip": value })));
      expect(headers[SECRET_HEADER]).toBeUndefined();
    }
  });

  test("accepts IPv4 and IPv6 only", () => {
    expect(validIp("212.28.230.77")).toBe("212.28.230.77");
    expect(validIp("2001:db8::1")).toBe("2001:db8::1");
    expect(validIp("<script>")).toBeNull();
    expect(validIp("1.2.3")).toBeNull();
  });
});
