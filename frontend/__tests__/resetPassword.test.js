import { fireEvent, render, screen, within } from "@testing-library/react";
import ResetPasswordPage from "../pages/reset-password";

const resetPassword = jest.fn();

jest.mock("next/router", () => ({ useRouter: () => ({ query: { token: "reset-token" }, isReady: true }) }));
jest.mock("../lib/api", () => ({ resetPassword: (...args) => resetPassword(...args) }));

const passwordInput = () => screen.getByLabelText("New password");
const type = (password) => fireEvent.change(passwordInput(), { target: { value: password } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Update password" }));

describe("Reset password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses the same help text, field and checklist as signup", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText("Use at least 12 characters. A short sentence works great.")).toBeInTheDocument();
    for (const attribute of ["pattern", "minlength"]) expect(passwordInput()).not.toHaveAttribute(attribute);
    const checklist = within(screen.getByRole("list", { name: "Password requirements" }));
    expect(checklist.getByText("At least 12 characters")).toBeInTheDocument();
    expect(checklist.getByText("Not a commonly used password")).toBeInTheDocument();
    // The page doesn't know the account's name or email, so it doesn't pretend to check them.
    expect(checklist.queryByText(/your name/)).not.toBeInTheDocument();
    type("my cat sleeps on the sofa");
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", "Strong");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput()).toHaveAttribute("type", "text");
  });

  test.each([
    ["short", "Your password needs at least 12 characters. A short sentence works great."],
    ["Password1234", "This password is too common and easy to guess. Please choose a different one."],
    ["😀".repeat(19), "This password is too long. Please use a shorter one."],
  ])("explains %s on submit and does not send it", (password, message) => {
    render(<ResetPasswordPage />);
    type(password);
    submit();
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent === message)).toBe(true);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  test("sends a good password and shows the server's message when it refuses (for example, it includes the name)", async () => {
    resetPassword.mockRejectedValueOnce(new Error("Your password can't include your name. Please choose a different one."));
    render(<ResetPasswordPage />);
    type("rana walks by the sea");
    submit();
    expect(resetPassword).toHaveBeenCalledWith("reset-token", "rana walks by the sea");
    expect(await screen.findByRole("alert")).toHaveTextContent("Your password can't include your name.");
  });

  test("confirms a successful reset", async () => {
    resetPassword.mockResolvedValueOnce({ message: "Password updated. You can now log in." });
    render(<ResetPasswordPage />);
    type("my cat sleeps on the sofa");
    submit();
    expect(await screen.findByText(/Password updated/)).toBeInTheDocument();
  });
});
