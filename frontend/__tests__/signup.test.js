import { fireEvent, render, screen, within } from "@testing-library/react";
import SignupPage from "../pages/signup";

const push = jest.fn();
const signup = jest.fn();

jest.mock("next/router", () => ({ useRouter: () => ({ push }) }));
jest.mock("../lib/api", () => ({ signup: (...args) => signup(...args) }));

const passwordInput = () => screen.getByLabelText("Password");
const type = (password) => fireEvent.change(passwordInput(), { target: { value: password } });
function fillIn({ name = "Sam Rivers", email = "sam.rivers@example.test", password }) {
  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: name } });
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: email } });
  type(password);
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
const checklistItem = (text) => within(screen.getByRole("list", { name: "Password requirements" })).getByText(text).closest("li");

describe("Signup password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows the plain help text, with no mention of a maximum", () => {
    render(<SignupPage />);
    expect(screen.getByText("Use at least 12 characters. A short sentence works great.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/bytes|UTF-8|maximum/i);
  });

  test("has no browser pattern or length checks that would show the generic format message", () => {
    render(<SignupPage />);
    for (const attribute of ["pattern", "minlength", "maxlength"]) expect(passwordInput()).not.toHaveAttribute(attribute);
    expect(passwordInput()).toHaveAttribute("autocomplete", "new-password");
  });

  test("shows no strength label before the user starts typing", () => {
    render(<SignupPage />);
    expect(screen.queryByRole("meter", { name: "Password strength" })).not.toBeInTheDocument();
  });

  test.each([
    ["short", "Weak"],
    ["password1234", "Weak"],
    ["quiet garden", "Good"],
    ["my cat sleeps on the sofa", "Strong"],
  ])("rates %s as %s", (password, strength) => {
    render(<SignupPage />);
    type(password);
    expect(screen.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuetext", strength);
    expect(screen.getByRole("status")).toHaveTextContent(`Password strength: ${strength}`);
  });

  test("updates the checklist as the user types", () => {
    render(<SignupPage />);
    fillIn({ password: "short" });
    expect(checklistItem("At least 12 characters")).toHaveAttribute("data-met", "false");
    expect(checklistItem("At least 12 characters")).toHaveTextContent("Not yet:");
    type("password1234");
    expect(checklistItem("At least 12 characters")).toHaveAttribute("data-met", "true");
    expect(checklistItem("At least 12 characters")).toHaveTextContent("Done:");
    expect(checklistItem("Not a commonly used password")).toHaveAttribute("data-met", "false");
    type("sam goes hiking often");
    expect(checklistItem("Not a commonly used password")).toHaveAttribute("data-met", "true");
    expect(checklistItem("Doesn't include your name, your email, or \"Nabad\"")).toHaveAttribute("data-met", "false");
    type("my cat sleeps on the sofa");
    expect(checklistItem("Doesn't include your name, your email, or \"Nabad\"")).toHaveAttribute("data-met", "true");
  });

  test.each([
    ["short", "Your password needs at least 12 characters. A short sentence works great."],
    ["password1234", "This password is too common and easy to guess. Please choose a different one."],
    ["sam goes hiking often", "Your password can't include your name. Please choose a different one."],
    ["my nabad heart app", "Your password can't include the word \"Nabad\". Please choose a different one."],
    ["a".repeat(73), "This password is too long. Please use a shorter one."],
  ])("explains %s in plain words on submit and does not send it", (password, message) => {
    render(<SignupPage />);
    fillIn({ password });
    submit();
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent === message)).toBe(true);
    expect(signup).not.toHaveBeenCalled();
    expect(passwordInput()).toHaveFocus();
  });

  test("shows only the short too-long message while typing, never bytes", () => {
    render(<SignupPage />);
    type("ب".repeat(37));
    expect(screen.getByRole("alert")).toHaveTextContent("This password is too long. Please use a shorter one.");
    expect(document.body).not.toHaveTextContent(/bytes|UTF-8/i);
  });

  test("submits a good passphrase and shows the server's message if it is refused", async () => {
    signup.mockRejectedValueOnce(new Error("This password has appeared in a data leak on another website, so it isn't safe to use. Please choose a different one."));
    render(<SignupPage />);
    fillIn({ password: "my cat sleeps on the sofa" });
    submit();
    expect(signup).toHaveBeenCalledWith("Sam Rivers", "sam.rivers@example.test", "my cat sleeps on the sofa");
    expect(await screen.findByText(/appeared in a data leak/)).toHaveAttribute("role", "alert");
    expect(push).not.toHaveBeenCalled();
  });

  test("show/hide toggle reveals the password and hides it again", () => {
    render(<SignupPage />);
    type("my cat sleeps on the sofa");
    expect(passwordInput()).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput()).toHaveAttribute("type", "text");
    expect(passwordInput()).toHaveValue("my cat sleeps on the sofa");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(signup).not.toHaveBeenCalled(); // the toggle does not submit the form
  });

  test("allows paste and copy", () => {
    render(<SignupPage />);
    for (const event of ["paste", "copy", "cut"]) {
      expect(fireEvent[event](passwordInput(), { clipboardData: { getData: () => "pasted pass phrase" } })).toBe(true); // not prevented
    }
  });
});
