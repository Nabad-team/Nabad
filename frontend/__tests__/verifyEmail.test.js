// Story #2: verify email. Tests the /verify-email page and the dashboard reminder banner.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyEmailPage from "../pages/verify-email";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import { verifyEmail, getMe, resendVerificationEmail } from "../lib/api";

let mockQuery = { token: "a".repeat(64) };
jest.mock("next/router", () => ({ useRouter: () => ({ query: mockQuery, isReady: true }) }));
jest.mock("../lib/api", () => ({ verifyEmail: jest.fn(), getMe: jest.fn(), resendVerificationEmail: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); mockQuery = { token: "a".repeat(64) }; });

describe("Verify email page", () => {
  test("sends the token from the link once and confirms success", async () => {
    verifyEmail.mockResolvedValue({ emailVerified: true });
    render(<VerifyEmailPage />);
    expect(await screen.findByText(/Your email is verified/)).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith("a".repeat(64));
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  test("shows the server's message for an invalid or expired link", async () => {
    verifyEmail.mockRejectedValue(new Error("This verification link is invalid or has expired. Sign in and request a new one."));
    render(<VerifyEmailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
  });

  test("a link without a token does not call the server", async () => {
    mockQuery = {};
    render(<VerifyEmailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("incomplete");
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});

describe("Email verification banner", () => {
  test("is shown to unverified users and resends the link", async () => {
    getMe.mockResolvedValue({ user: { email: "rana@example.test", emailVerified: false } });
    resendVerificationEmail.mockResolvedValue({ message: "A new verification link was sent to rana@example.test." });
    const user = userEvent.setup();
    render(<EmailVerificationBanner />);
    expect(await screen.findByText(/Please verify your email/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("A new verification link was sent");
  });

  test("explains the one-minute wait when resend is rate-limited", async () => {
    getMe.mockResolvedValue({ user: { email: "rana@example.test", emailVerified: false } });
    resendVerificationEmail.mockRejectedValue(Object.assign(new Error("Please wait"), { status: 429 }));
    const user = userEvent.setup();
    render(<EmailVerificationBanner />);
    await user.click(await screen.findByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("wait a minute");
  });

  test("is hidden for verified users and when the check fails", async () => {
    getMe.mockResolvedValue({ user: { email: "rana@example.test", emailVerified: true } });
    const { container, unmount } = render(<EmailVerificationBanner />);
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();
    getMe.mockRejectedValue(new Error("offline"));
    const second = render(<EmailVerificationBanner />);
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });
});
