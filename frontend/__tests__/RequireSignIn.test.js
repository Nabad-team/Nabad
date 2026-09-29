// Automated tests for pages that need sign-in (components/RequireSignIn.js, used by pages/_app.js).
import { render, screen, waitFor, act } from "@testing-library/react";
import MyApp from "../pages/_app";
import DashboardPage from "../pages/dashboard";
import ProfilePage from "../pages/profile";
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

  test("only the dashboard and profile pages need sign-in", () => {
    expect(DashboardPage.requireSignIn).toBe(true);
    expect(ProfilePage.requireSignIn).toBe(true);
    for (const page of [HomePage, LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage]) {
      expect(page.requireSignIn).toBeUndefined();
    }
  });
});
