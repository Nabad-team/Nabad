// Staging (main's stable URL and PR previews) shows a test-data banner and asks search engines not to index it.
// Production shows nothing extra.
import { render, screen } from "@testing-library/react";
import StagingBanner from "../components/StagingBanner";
import { isStaging } from "../lib/appEnvironment";
import { sentryEnvironment } from "../lib/sentry";

// next/head renders nothing in tests; show its children so the robots tag can be checked.
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }) => <>{children}</> }));

const ORIGINAL_ENV = process.env;
function setEnv(env) {
  process.env = { ...ORIGINAL_ENV, ...env };
  for (const key of ["NEXT_PUBLIC_APP_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_SENTRY_ENVIRONMENT"]) if (!(key in env)) delete process.env[key];
}
afterEach(() => { process.env = ORIGINAL_ENV; });

describe("isStaging", () => {
  test("is true for NEXT_PUBLIC_APP_ENV=staging and for any Vercel preview", () => {
    expect(isStaging("staging", undefined)).toBe(true);
    expect(isStaging(undefined, "preview")).toBe(true);
    expect(isStaging("staging", "preview")).toBe(true);
  });

  test("is false for production and local development", () => {
    expect(isStaging(undefined, "production")).toBe(false);
    expect(isStaging(undefined, undefined)).toBe(false);
    expect(isStaging("production", "production")).toBe(false);
    expect(isStaging("development", "development")).toBe(false);
  });
});

describe("StagingBanner", () => {
  test("on staging, says the data is test data and adds a noindex robots tag", () => {
    setEnv({ NEXT_PUBLIC_APP_ENV: "staging", NEXT_PUBLIC_VERCEL_ENV: "preview" });
    render(<StagingBanner />);
    expect(screen.getByRole("region", { name: "Staging environment" })).toHaveTextContent("Staging: test data only.");
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  test("a preview without NEXT_PUBLIC_APP_ENV still shows the banner", () => {
    setEnv({ NEXT_PUBLIC_VERCEL_ENV: "preview" });
    render(<StagingBanner />);
    expect(screen.getByRole("region", { name: "Staging environment" })).toBeInTheDocument();
  });

  test("production renders nothing at all", () => {
    setEnv({ NEXT_PUBLIC_VERCEL_ENV: "production" });
    const { container } = render(<StagingBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  test("local development renders nothing", () => {
    setEnv({});
    const { container } = render(<StagingBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Sentry environment", () => {
  test("staging and previews report as staging, production as production", () => {
    setEnv({ NEXT_PUBLIC_APP_ENV: "staging", NEXT_PUBLIC_VERCEL_ENV: "preview" });
    expect(sentryEnvironment()).toBe("staging");
    setEnv({ NEXT_PUBLIC_VERCEL_ENV: "preview" });
    expect(sentryEnvironment()).toBe("staging");
    setEnv({ NEXT_PUBLIC_VERCEL_ENV: "production" });
    expect(sentryEnvironment()).toBe("production");
  });

  test("an explicit NEXT_PUBLIC_SENTRY_ENVIRONMENT still wins", () => {
    setEnv({ NEXT_PUBLIC_VERCEL_ENV: "preview", NEXT_PUBLIC_SENTRY_ENVIRONMENT: "qa" });
    expect(sentryEnvironment()).toBe("qa");
  });
});
