// Error tracking (story #89): what the browser SDK would send to Sentry. The real SDK runs with a transport that
// records each envelope instead of sending it, so these tests check the actual payload: never health or personal
// data, only the error type, stack trace, route, status, requestId and environment.
import * as Sentry from "@sentry/nextjs";
import { render, screen } from "@testing-library/react";
import { scrubEvent, browserOptions, serverOptions } from "../lib/sentry";
import ErrorPage from "../pages/_error";

const SYMPTOM = "crushing chest pain spreading to my left arm";
const EMAIL = "rana.haddad@example.test";
const COOKIE = "accessToken=eyJhbGciOiJIUzI1NiJ9.secret-session";
const TOKEN = "a".repeat(64);
const IP = "203.0.113.42";
const PERSONAL = [SYMPTOM, "chest pain", EMAIL, "rana.haddad", COOKIE, "secret-session", TOKEN, IP, "?token", "?email"];

function expectNothingPersonal(text) {
  for (const value of PERSONAL) expect(text).not.toContain(value);
}

describe("scrubEvent", () => {
  test("keeps only the allowlisted fields, and file names without their query string", () => {
    const scrubbed = scrubEvent({
      event_id: "abc", timestamp: 1, platform: "javascript", level: "error", environment: "production", release: "abc123",
      message: SYMPTOM, transaction: `/care-circle/accept?token=${TOKEN}`,
      exception: { values: [{ type: "TypeError", value: `Cannot read "${SYMPTOM}" for ${EMAIL}`, mechanism: { type: "onerror", handled: false, data: { url: EMAIL } },
        stacktrace: { frames: [{ filename: `https://nabad.example/care-circle/accept?token=${TOKEN}#top`, abs_path: `https://nabad.example/care-circle/accept?token=${TOKEN}`, function: "accept", lineno: 3, colno: 9, in_app: true, vars: { description: SYMPTOM }, context_line: SYMPTOM }] } }] },
      tags: { route: "/care-circle/accept", status: 500, email: EMAIL },
      user: { email: EMAIL, ip_address: IP }, request: { url: `https://nabad.example/symptoms?email=${EMAIL}`, cookies: COOKIE, headers: { Cookie: COOKIE } },
      extra: { SYMPTOM }, contexts: { browser: {} }, breadcrumbs: [{ message: SYMPTOM }],
      sdk: { name: "sentry.javascript.nextjs", version: "11.6.0", integrations: ["x"] },
    });
    expect(scrubbed).toEqual({
      event_id: "abc", timestamp: 1, platform: "javascript", level: "error", environment: "production",
      exception: { values: [{ type: "TypeError", mechanism: { type: "onerror", handled: false },
        stacktrace: { frames: [{ filename: "https://nabad.example/care-circle/accept", abs_path: "https://nabad.example/care-circle/accept", function: "accept", lineno: 3, colno: 9, in_app: true }] } }] },
      tags: { route: "/care-circle/accept", status: "500" },
      sdk: { name: "sentry.javascript.nextjs", version: "11.6.0" },
    });
  });
});

describe("the browser SDK as configured", () => {
  const sent = [];
  beforeAll(() => {
    window.next = { router: { pathname: "/symptoms", asPath: `/symptoms?email=${EMAIL}` } };
    Sentry.init({
      ...browserOptions(Sentry),
      dsn: "https://publickey@o123.ingest.de.sentry.io/1",
      environment: "production",
      // Records the envelope the SDK would send.
      transport: () => ({ send: async (envelope) => { sent.push(JSON.stringify(envelope)); return {}; }, flush: async () => true }),
    });
  });
  afterAll(async () => { await Sentry.close(); delete window.next; });

  test("an error with a symptom text, an email and a cookie is scrubbed before sending", async () => {
    document.cookie = COOKIE;
    Sentry.withScope((scope) => {
      scope.setUser({ id: "user-1", email: EMAIL, ip_address: IP });
      scope.setExtra("symptoms", SYMPTOM);
      scope.setContext("form", { description: SYMPTOM });
      scope.setTag("email", EMAIL);
      scope.addBreadcrumb({ category: "ui.input", message: `typed ${SYMPTOM}` });
      scope.addEventProcessor((event) => ({
        ...event,
        request: { url: `https://nabad.example/symptoms?email=${EMAIL}`, cookies: { accessToken: COOKIE }, headers: { Cookie: COOKIE, "User-Agent": "Test" } },
      }));
      Sentry.captureException(new Error(`Could not save "${SYMPTOM}" for ${EMAIL}`));
    });
    await Sentry.flush(1000);

    expect(sent).toHaveLength(1);
    expectNothingPersonal(sent[0]);
    const event = JSON.parse(sent[0])[1][0][1];
    expect(event.tags).toEqual({ route: "/symptoms" });
    expect(event.environment).toBe("production");
    expect(event.exception.values[0].type).toBe("Error");
    expect(event.exception.values[0].value).toBeUndefined();
    // Sentry must not record the visitor's IP address from the connection either.
    expect(event.sdk.settings).toEqual({ infer_ip: "never" });
    for (const field of ["request", "user", "extra", "contexts", "breadcrumbs", "message", "release", "transaction"]) expect(event[field]).toBeUndefined();
  });

  test("only the error-catching integrations run: no session replay, tracing, breadcrumbs or request data", () => {
    const names = Sentry.getClient().getOptions().integrations.map((integration) => integration.name);
    expect(names.sort()).toEqual(["Dedupe", "GlobalHandlers", "LinkedErrors"]);
    const options = Sentry.getClient().getOptions();
    expect(options.sendDefaultPii).toBe(false);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
    // Sentry v11 no longer reads sendDefaultPii: every kind of data collection must be off explicitly.
    expect(Sentry.getClient().getDataCollectionOptions()).toEqual({
      userInfo: false, cookies: false, httpHeaders: { request: false, response: false }, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
      databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0,
    });
  });
});

test("the Next.js server uses the same scrubbing, without default integrations", () => {
  const options = serverOptions({ linkedErrorsIntegration: () => ({ name: "LinkedErrors" }), dedupeIntegration: () => ({ name: "Dedupe" }) });
  expect(options.defaultIntegrations).toBe(false);
  expect(options.sendDefaultPii).toBe(false);
  expect(options.beforeSend).toBe(scrubEvent);
  expect(options.integrations.map(({ name }) => name)).toEqual(["LinkedErrors", "Dedupe"]);
});

describe("the error page", () => {
  test("looks like the 500 page", () => {
    render(<ErrorPage />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  });

  test("without a DSN it reports nothing and keeps the status", async () => {
    const spy = jest.spyOn(Sentry, "captureUnderscoreErrorException");
    expect(await ErrorPage.getInitialProps({ res: { statusCode: 500 }, pathname: "/profile" })).toEqual({ statusCode: 500 });
    expect(spy).not.toHaveBeenCalled();
  });
});
