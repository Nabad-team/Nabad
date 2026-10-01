// Automated tests for the /api forwarding in next.config.js.
const ORIGINAL_ENV = process.env;

function loadConfig(env) {
  process.env = { ...ORIGINAL_ENV, VERCEL: undefined, VERCEL_ENV: undefined, BACKEND_URL: undefined, ...env };
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
});
