// Automated tests for pages that need sign-in (components/RequireSignIn.js, used by pages/_app.js).
import { render, screen, waitFor, act } from "@testing-library/react";
import MyApp from "../pages/_app";
import DashboardPage from "../pages/dashboard";
import ProfilePage from "../pages/profile";
import SecurityPage from "../pages/security";
import OnboardingPage from "../pages/onboarding";
import MyHealthPage from "../pages/my-health";
import SymptomsPage from "../pages/symptoms";
import NotificationsPage from "../pages/notifications";
import CareCirclePage from "../pages/care-circle";
import HomePage from "../pages/index";
import LoginPage from "../pages/login";
import SignupPage from "../pages/signup";
import ForgotPasswordPage from "../pages/forgot-password";
import ResetPasswordPage from "../pages/reset-password";
import { signOut } from "../lib/session";

const replace = jest.fn();
const getSession = jest.fn();
const logout = jest.fn();
let asPath = "/dashboard";

jest.mock("next/router", () => ({
  __esModule: true,
  default: { replace: (...args) => replace(...args) },
  useRouter: () => ({ asPath, replace: (...args) => replace(...args) }),
}));

jest.mock("../lib/api", () => ({
  getSession: (...args) => getSession(...args),
  logout: (...args) => logout(...args),
  googleLoginUrl: () => "/api/auth/google",
}));

const SESSION = { idleTimeoutMs: 30 * 60 * 1000, warningBeforeMs: 2 * 60 * 1000, absoluteExpiresAt: Date.now() + 12 * 60 * 60 * 1000 };
const signedOut = () => Promise.reject(Object.assign(new Error("Not authenticated."), { status: 401 }));

// Small stand-ins for real pages, so the tests only look at the sign-in rules.
function PrivatePage() {
  return <p>Private health data</p>;
}
PrivatePage.requireSignIn = true;
function PublicPage() {
  return <p>Public page</p>;
}

describe("Pages that need sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    asPath = "/dashboard";
    logout.mockResolvedValue({});
  });

  test("shows nothing while checking whether the user is signed in", async () => {
    getSession.mockReturnValue(new Promise(() => {})); // the server has not answered yet
    render(<MyApp Component={PrivatePage} pageProps={{}} />);

    await act(async () => {});
    expect(screen.queryByText("Private health data")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test("shows the loading placeholder, not the page and not /login, while checking", async () => {
    getSession.mockReturnValue(new Promise(() => {}));
    const { container } = render(<MyApp Component={PrivatePage} pageProps={{}} />);

    await act(async () => {});
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(container.querySelector(".loader")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  test("a failed check that isn't a 401 (sleeping server, lost connection) is tried again instead of sending a signed-in user to /login", async () => {
    jest.useFakeTimers();
    try {
      const offline = () => Promise.reject(Object.assign(new Error("Cannot connect to Nabad."), { status: 0 }));
      getSession.mockImplementationOnce(offline).mockImplementationOnce(() => Promise.reject(Object.assign(new Error("Bad gateway"), { status: 502 })))
        .mockResolvedValue(SESSION);
      const { container } = render(<MyApp Component={PrivatePage} pageProps={{}} />);
      await act(async () => {});
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      await act(async () => { jest.advanceTimersByTime(1000); });
      await act(async () => { jest.advanceTimersByTime(3000); });
      expect(screen.getByText("Private health data")).toBeInTheDocument();
      expect(getSession).toHaveBeenCalledTimes(3);
      expect(replace).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test("when the check keeps failing, the page says so and Try again asks once more; nobody is sent to /login", async () => {
    jest.useFakeTimers();
    try {
      getSession.mockImplementation(() => Promise.reject(Object.assign(new Error("Nabad took too long to respond."), { status: 0 })));
      render(<MyApp Component={PrivatePage} pageProps={{}} />);
      await act(async () => {});
      for (const wait of [1000, 3000, 8000]) await act(async () => { jest.advanceTimersByTime(wait); });
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't check that you're signed in.");
      expect(screen.getByRole("alert")).toHaveTextContent("140");
      expect(replace).not.toHaveBeenCalled();
      expect(getSession).toHaveBeenCalledTimes(4);

      getSession.mockResolvedValue(SESSION);
      await act(async () => { screen.getByRole("button", { name: "Try again" }).click(); });
      expect(screen.getByText("Private health data")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test("sends a signed-out visitor to log in, remembering the page, without showing it", async () => {
    asPath = "/profile?tab=contacts";
    getSession.mockImplementation(signedOut);
    render(<MyApp Component={PrivatePage} pageProps={{}} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fprofile%3Ftab%3Dcontacts"));
    expect(screen.queryByText("Private health data")).not.toBeInTheDocument();
  });

  test("shows the page to a signed-in user", async () => {
    getSession.mockResolvedValue(SESSION);
    render(<MyApp Component={PrivatePage} pageProps={{}} />);

    expect(await screen.findByText("Private health data")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test("after logging in, the next page is shown instead of bouncing back to /login", async () => {
    // On the login page, signed out.
    asPath = "/login?next=%2Fprofile";
    getSession.mockImplementation(signedOut);
    const { rerender } = render(<MyApp Component={PublicPage} pageProps={{}} />);
    await act(async () => {});

    // Logged in; the login page now opens /profile.
    getSession.mockResolvedValue(SESSION);
    asPath = "/profile";
    rerender(<MyApp Component={PrivatePage} pageProps={{}} />);

    expect(await screen.findByText("Private health data")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test("public pages are shown straight away, signed in or not", async () => {
    asPath = "/";
    getSession.mockImplementation(signedOut);
    render(<MyApp Component={PublicPage} pageProps={{}} />);

    expect(screen.getByText("Public page")).toBeInTheDocument();
    await act(async () => {});
    expect(screen.getByText("Public page")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test("hides the page as soon as the user signs out, and goes to the plain login page", async () => {
    getSession.mockResolvedValue(SESSION);
    render(<MyApp Component={PrivatePage} pageProps={{}} />);
    await screen.findByText("Private health data");

    await act(async () => {
      await signOut();
    });

    expect(screen.queryByText("Private health data")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  test.each([
    ["/dashboard", DashboardPage],
    ["/profile", ProfilePage],
    ["/security", SecurityPage],
    ["/onboarding", OnboardingPage],
    ["/my-health", MyHealthPage],
    ["/symptoms", SymptomsPage],
    ["/notifications", NotificationsPage],
    ["/care-circle", CareCirclePage],
  ])("the real %s page sends a signed-out visitor to log in without showing anything", async (path, Page) => {
    asPath = path;
    getSession.mockImplementation(signedOut);
    const { container } = render(<MyApp Component={Page} pageProps={{}} />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=" + encodeURIComponent(path)));
    expect(container).toBeEmptyDOMElement();
  });

  test("onboarding still opens right after signing up", async () => {
    // On the signup page, signed out.
    asPath = "/signup";
    getSession.mockImplementation(signedOut);
    const { rerender } = render(<MyApp Component={SignupPage} pageProps={{}} />);
    await act(async () => {});

    // Signing up signs the user in, and the signup page opens /onboarding.
    getSession.mockResolvedValue(SESSION);
    asPath = "/onboarding";
    rerender(<MyApp Component={OnboardingPage} pageProps={{}} />);

    expect(await screen.findByRole("heading", { name: "Welcome to Nabad" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  test("the dashboard, profile, security, onboarding and symptoms pages need sign-in", () => {
    for (const page of [DashboardPage, ProfilePage, SecurityPage, OnboardingPage, SymptomsPage]) {
      expect(page.requireSignIn).toBe(true);
    }
    for (const page of [HomePage, LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage]) {
      expect(page.requireSignIn).toBeUndefined();
    }
  });
});
