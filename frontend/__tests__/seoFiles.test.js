// Automated tests for public/robots.txt, public/sitemap.xml and the icons: search engines may only list
// the public pages, and every page in pages/ must be either allowed or kept out.
const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "../public", file), "utf8");
const PUBLIC_PAGES = ["/", "/providers", "/privacy", "/terms", "/contact"];
const SITE_URL = "https://nabad-psi.vercel.app";

const rules = (directive) =>
  read("robots.txt")
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`${directive}:`))
    .map((line) => line.slice(directive.length + 1).trim());

// pages/medications.js -> /medications, pages/index.js -> /, pages/care-circle/ -> /care-circle (which covers the
// pages inside it). Next.js's own files (_app, 404...) are skipped.
const allPages = fs
  .readdirSync(path.join(__dirname, "../pages"), { withFileTypes: true })
  .filter((entry) => (entry.isDirectory() ? /^[a-z][\w-]*$/.test(entry.name) && entry.name !== "api" : /^[a-z][\w-]*\.js$/.test(entry.name)))
  .map(({ name }) => (name === "index.js" ? "/" : `/${name.replace(/\.js$/, "")}`));

describe("robots.txt", () => {
  test("allows exactly the public pages", () => {
    expect(rules("Allow").map((rule) => rule.replace(/\$$/, ""))).toEqual(PUBLIC_PAGES);
  });

  test("keeps the API and every other page out of search engines", () => {
    const disallowed = rules("Disallow");
    expect(disallowed).toContain("/api/");
    const privatePages = allPages.filter((page) => !PUBLIC_PAGES.includes(page));
    expect(privatePages.length).toBeGreaterThan(0);
    for (const page of privatePages) expect(disallowed).toContain(page);
  });

  test("points to the sitemap", () => {
    expect(rules("Sitemap")).toEqual([`${SITE_URL}/sitemap.xml`]);
  });
});

describe("sitemap.xml", () => {
  test("lists the public pages on the official site", () => {
    const urls = [...read("sitemap.xml").matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    expect(urls).toEqual(PUBLIC_PAGES.map((page) => `${SITE_URL}${page}`));
  });
});

describe("web app manifest", () => {
  test("names the app, uses the teal theme and lists icons that exist", () => {
    const manifest = JSON.parse(read("site.webmanifest"));
    expect(manifest.short_name).toBe("Nabad");
    expect(manifest.name).toMatch(/^Nabad/);
    expect(manifest.theme_color).toBe("#0f766e");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
    for (const icon of manifest.icons) expect(fs.existsSync(path.join(__dirname, "../public", icon.src))).toBe(true);
  });

  test("the favicon and home screen icons exist", () => {
    for (const file of ["favicon.svg", "favicon-32x32.png", "apple-touch-icon.png"]) {
      expect(fs.existsSync(path.join(__dirname, "../public", file))).toBe(true);
    }
  });
});
