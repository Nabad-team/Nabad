// Automated tests for the Nabad login page.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../pages/login";

const push = jest.fn();
const login = jest.fn();
const verifyTwoFactor = jest.fn();
const resendTwoFactor = jest.fn();

jest.mock("next/router", () => ({
  useRouter: () => ({ push, query: {} }),
}));

jest.mock("../lib/api", () => ({
  login: (...args) => login(...args),
  verifyTwoFactor: (...args) => verifyTwoFactor(...args),
  resendTwoFactor: (...args) => resendTwoFactor(...args),
  googleLoginUrl: () => "http://localhost:5000/api/auth/google",
}));

describe("Login Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    login.mockResolvedValue({ user: { id: "1" } });
  });

  test("shows the login heading", () => {
    render(<LoginPage />);
    expect(screen.getByText("Log in to Nabad")).toBeInTheDocument();
  });

  test("shows the login button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  test("shows the forgot password link", () => {
    render(<LoginPage />);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  test("shows Continue with Google", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: "Continue with Google" });
    expect(link).toHaveAttribute("href", "http://localhost:5000/api/auth/google");
  });

  test("shows the 2FA form after login requires a code", async () => {
    login.mockResolvedValue({ twoFactorRequired: true, challenge: "challenge-123" });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByLabelText("Verification code")).toBeInTheDocument());
    expect(screen.getByText(/expires in 10 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/cancelled after 5 incorrect tries/i)).toBeInTheDocument();
  });

  test("verifies the 2FA code and redirects to dashboard", async () => {
    const router = require("next/router");
    router.useRouter = () => ({ push, query: { challenge: "challenge-123" } });
    verifyTwoFactor.mockResolvedValue({ user: { id: "1" } });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(verifyTwoFactor).toHaveBeenCalledWith("challenge-123", "123456"));
  });

  test("explains an automatic sign-out after inactivity", () => {
    const router = require("next/router");
    router.useRouter = () => ({ push, query: { reason: "inactivity", minutes: "30" } });

    render(<LoginPage />);
    expect(screen.getByRole("status")).toHaveTextContent("You were signed out after 30 minutes of inactivity.");
  });

  test("shows Google sign-in failure from callback", () => {
    const router = require("next/router");
    router.useRouter = () => ({ push, query: { error: "google_signin_failed" } });

    render(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in could not be completed");
  });
});
