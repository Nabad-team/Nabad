/**
 * @jest-environment node
 */
// next.config.js runs in Node, not in a browser.
// Automated tests for the /api forwarding in next.config.js.
const ORIGINAL_ENV = process.env;

function loadConfig(env) {
  process.env = { ...ORIGINAL_ENV, VERCEL: undefined, VERCEL_ENV: undefined, BACKEND_URL: undefined, NEXT_PUBLIC_SENTRY_DSN: undefined, ...env };
  for (const key of Object.keys(process.env)) if (process.env[key] === undefined) delete process.env[key];
  let config;
  jest.isolateModules(() => { config = require("../next.config"); });
  return config;
}

async function destination(env) {
  const [rule] = await loadConfig(env).rewrites();
  return rule.destination;
}

describe("next.config.js", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => { process.env = ORIGINAL_ENV; jest.restoreAllMocks(); });

  test("local development falls back to localhost:5000", async () => {
    expect(await destination({})).toBe("http://localhost:5000/api/:path*");
  });

  test("forwards /api to BACKEND_URL without a trailing slash", async () => {
    expect(await destination({ BACKEND_URL: "https://nabad-backend-nhv5.onrender.com/" }))
      .toBe("https://nabad-backend-nhv5.onrender.com/api/:path*");
  });

  test("a production build without BACKEND_URL fails, naming the variable", () => {
    expect(() => loadConfig({ VERCEL: "1", VERCEL_ENV: "production" })).toThrow(/BACKEND_URL/);
    expect(() => loadConfig({ VERCEL: "1", VERCEL_ENV: "production", BACKEND_URL: " " })).toThrow(/BACKEND_URL/);
  });

  test("a production build with BACKEND_URL succeeds", async () => {
    expect(await destination({ VERCEL: "1", VERCEL_ENV: "production", BACKEND_URL: "https://nabad-backend-nhv5.onrender.com" }))
      .toBe("https://nabad-backend-nhv5.onrender.com/api/:path*");
  });

  test("a preview build without BACKEND_URL only warns", async () => {
    expect(await destination({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe("http://localhost:5000/api/:path*");
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/BACKEND_URL is not set/));
  });

  describe("security headers", () => {
    async function headersFor(path, env = {}) {
      const rules = await loadConfig(env).headers();
      const headers = {};
      // Same matching as Next.js for these two rules; a later rule replaces an earlier one with the same key.
      for (const rule of rules) {
        if (rule.source === "/:path*" || rule.source === path) {
          for (const { key, value } of rule.headers) headers[key] = value;
        }
      }
      return headers;
    }

    test("hides the X-Powered-By header", () => {
      expect(loadConfig({}).poweredByHeader).toBe(false);
    });

    test("sends the anti-framing, sniffing and referrer headers on every page", async () => {
      const headers = await headersFor("/dashboard");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    });

    test("the Content-Security-Policy allows the site, the map tiles and nothing else", async () => {
      const csp = (await headersFor("/"))["Content-Security-Policy"];
      const directives = Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
      expect(directives["default-src"]).toEqual(["'self'"]);
      expect(directives["img-src"]).toContain("https://tile.openstreetmap.org");
      expect(directives["connect-src"]).toEqual(["'self'"]);
      expect(directives["frame-ancestors"]).toEqual(["'none'"]);
      expect(directives["object-src"]).toEqual(["'none'"]);
      expect(directives["script-src"]).not.toContain("'unsafe-eval'");
    });

    test("next dev may evaluate scripts (fast refresh), production may not", async () => {
      const csp = (await headersFor("/", { NODE_ENV: "development" }))["Content-Security-Policy"];
      expect(csp).toMatch(/script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
    });

    describe("with error tracking (NEXT_PUBLIC_SENTRY_DSN)", () => {
      const DSN = "https://publickey@o123.ingest.de.sentry.io/4507";
      const connectSrc = async (env) => {
        const csp = (await headersFor("/", env))["Content-Security-Policy"];
        return csp.split("; ").find((directive) => directive.startsWith("connect-src "));
      };

      test("allows Sentry's ingest host only, and only when a DSN is set", async () => {
        expect(await connectSrc({})).toBe("connect-src 'self'");
        expect(await connectSrc({ NEXT_PUBLIC_SENTRY_DSN: DSN })).toBe("connect-src 'self' https://o123.ingest.de.sentry.io");
      });

      test("keeps every other setting", async () => {
        const config = loadConfig({ NEXT_PUBLIC_SENTRY_DSN: DSN });
        expect(config.poweredByHeader).toBe(false);
        expect((await config.rewrites())[0].destination).toBe("http://localhost:5000/api/:path*");
        expect((await headersFor("/", { NEXT_PUBLIC_SENTRY_DSN: DSN }))["X-Frame-Options"]).toBe("DENY");
      });

      test("a malformed DSN fails the build, and a deployed build needs https", () => {
        expect(() => loadConfig({ NEXT_PUBLIC_SENTRY_DSN: "not a dsn" })).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
        expect(() => loadConfig({ VERCEL: "1", VERCEL_ENV: "preview", NEXT_PUBLIC_SENTRY_DSN: "http://key@o1.ingest.sentry.io/1" })).toThrow(/https/);
      });
    });

    test("allows the microphone everywhere on the site, and location only on the providers page", async () => {
      expect((await headersFor("/symptoms"))["Permissions-Policy"]).toBe("camera=(), microphone=(self), geolocation=()");
      expect((await headersFor("/providers"))["Permissions-Policy"]).toBe("camera=(), microphone=(self), geolocation=(self)");
    });
  });
});
