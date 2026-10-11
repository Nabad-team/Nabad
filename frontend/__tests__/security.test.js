// Automated tests for the account security page.
import { render, screen } from "@testing-library/react";
import SecurityPage from "../pages/security";

const getMe = jest.fn();
jest.mock("../lib/api", () => ({
  getMe: (...args) => getMe(...args),
  beginTwoFactorSetup: jest.fn(),
  enableTwoFactor: jest.fn(),
  disableTwoFactor: jest.fn(),
}));

describe("Security page", () => {
  test("a Google account sees no 2FA controls", async () => {
    getMe.mockResolvedValue({ user: { authProvider: "google", twoFactorEnabled: false } });
    render(<SecurityPage />);

    expect(await screen.findByText(/You sign in with Google/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /two-factor|2FA/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  test("a Google account that turned 2FA on earlier still sees no controls", async () => {
    getMe.mockResolvedValue({ user: { authProvider: "google", twoFactorEnabled: true } });
    render(<SecurityPage />);

    expect(await screen.findByText(/You sign in with Google/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off 2FA" })).not.toBeInTheDocument();
  });

  test("a password account can set up 2FA", async () => {
    getMe.mockResolvedValue({ user: { authProvider: "password", twoFactorEnabled: false } });
    render(<SecurityPage />);

    expect(await screen.findByRole("button", { name: "Set up two-factor authentication" })).toBeInTheDocument();
    expect(screen.queryByText(/You sign in with Google/)).not.toBeInTheDocument();
  });

  test("a password account with 2FA on can turn it off with its password", async () => {
    getMe.mockResolvedValue({ user: { authProvider: "password", twoFactorEnabled: true } });
    render(<SecurityPage />);

    expect(await screen.findByRole("button", { name: "Turn off 2FA" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
