import { fireEvent, render, screen } from "@testing-library/react";
import SignupPage from "../pages/signup";

const push = jest.fn();
const signup = jest.fn();

jest.mock("next/router", () => ({ useRouter: () => ({ push }) }));
jest.mock("../lib/api", () => ({ signup: (...args) => signup(...args) }));

describe("Signup password strength", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows no strength label before the user starts typing", () => {
    render(<SignupPage />);

    expect(screen.queryByRole("meter", { name: "Password strength" })).not.toBeInTheDocument();
  });

  test.each([
    ["short", "Weak"],
    ["Password1234", "Normal"],
    ["StrongPassword123!", "Strong"],
  ])("rates %s as %s", (password, strength) => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });

    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", strength);
    expect(screen.getByRole("status")).toHaveTextContent(`Password strength: ${strength}`);
  });

  test("marks passwords over bcrypt's byte limit as weak", () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Ä".repeat(36) + "Aa1!" } });

    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", "Weak");
    expect(screen.getByRole("status")).toHaveTextContent("exceeds the 72-byte limit");
  });
});