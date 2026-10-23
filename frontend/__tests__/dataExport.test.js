// "Download my data" on the profile page (story #72): what it explains, the confirmation step, the download and
// its file name, and the success and error messages.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataExport from "../components/DataExport";
import PrivacyPolicy from "../pages/privacy";
import { exportFileName } from "../lib/dataExportApi";
import { todayString } from "../lib/dates";

const json = (status, body) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  blob: () => Promise.resolve(new Blob([JSON.stringify(body)], { type: "application/json" })),
});

let clicked;
beforeEach(() => {
  clicked = [];
  global.fetch = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:nabad-export");
  URL.revokeObjectURL = jest.fn();
  // jsdom can't download: record which file the page asked the browser to save.
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
    clicked.push({ href: this.href, download: this.download });
  });
});
afterEach(() => jest.restoreAllMocks());

// fetch answers in order: the confirmation, then the download.
function answer(...responses) {
  responses.forEach((response) => global.fetch.mockImplementationOnce(() => response));
}
async function openAndConfirm(user, secret, label = "Password") {
  await user.click(screen.getByRole("button", { name: "Download my data" }));
  await user.type(screen.getByLabelText(label), secret);
  await user.click(screen.getByRole("button", { name: "Confirm and download" }));
}

test("explains what the file includes and what it never includes", () => {
  render(<DataExport />);
  expect(screen.getByRole("heading", { name: "Download my data" })).toBeInTheDocument();
  expect(screen.getByText(/medications and check-ins, My health, water and sleep, symptom checks, appointments/)).toBeInTheDocument();
  expect(screen.getByText("Your favorite providers and your care circle")).toBeInTheDocument();
  expect(screen.getByText(/never includes your password or sign-in security details/)).toBeInTheDocument();
  // Nothing is asked or loaded until the user chooses to download.
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("asks for the password, then downloads nabad-data-<today>.json and says so", async () => {
  const user = userEvent.setup({ delay: null });
  answer(json(204, {}), json(200, { formatVersion: 1 }));
  render(<DataExport />);

  await user.click(screen.getByRole("button", { name: "Download my data" }));
  expect(screen.getByLabelText("Password")).toHaveFocus();
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(/confirm it's you/);
  await user.type(screen.getByLabelText("Password"), "my password");
  await user.click(screen.getByRole("button", { name: "Confirm and download" }));

  const fileName = `nabad-data-${todayString()}.json`;
  expect(await screen.findByRole("status")).toHaveTextContent(`Your data was downloaded as ${fileName}. We've emailed you to let you know.`);
  expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/account/export/confirm", expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "my password" }), credentials: "include" }));
  expect(global.fetch).toHaveBeenNthCalledWith(2, "/api/account/export", { credentials: "include" });
  expect(clicked).toEqual([{ href: "blob:nabad-export", download: fileName }]);
  // The form closes and the password is forgotten.
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
});

test("Google sign-in accounts confirm with their email", async () => {
  const user = userEvent.setup({ delay: null });
  answer(json(204, {}), json(200, {}));
  render(<DataExport isGoogleAccount />);
  await openAndConfirm(user, "maya@example.com", "Email");
  await screen.findByRole("status");
  expect(global.fetch.mock.calls[0][1].body).toBe(JSON.stringify({ email: "maya@example.com" }));
});

test("an empty field is explained without calling the API", async () => {
  const user = userEvent.setup({ delay: null });
  render(<DataExport />);
  await user.click(screen.getByRole("button", { name: "Download my data" }));
  await user.click(screen.getByRole("button", { name: "Confirm and download" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter your password to confirm it's you.");
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a wrong password shows the error and downloads nothing", async () => {
  const user = userEvent.setup({ delay: null });
  answer(json(400, { error: "Password is incorrect." }));
  render(<DataExport />);
  await openAndConfirm(user, "wrong");
  expect(await screen.findByRole("alert")).toHaveTextContent("Password is incorrect.");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(clicked).toEqual([]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  // The user can try again.
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
});

test("the hourly limit is explained", async () => {
  const user = userEvent.setup({ delay: null });
  answer(json(204, {}), json(429, { error: "You can download your data up to 3 times an hour. Please try again later." }));
  render(<DataExport />);
  await openAndConfirm(user, "my password");
  expect(await screen.findByRole("alert")).toHaveTextContent("up to 3 times an hour");
  expect(clicked).toEqual([]);
});

test("a network failure says what to do", async () => {
  const user = userEvent.setup({ delay: null });
  global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<DataExport />);
  await openAndConfirm(user, "my password");
  expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't download your data. Please check your connection and try again.");
});

test("Cancel closes the confirmation", async () => {
  const user = userEvent.setup({ delay: null });
  render(<DataExport />);
  await user.click(screen.getByRole("button", { name: "Download my data" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download my data" })).toBeInTheDocument();
});

test("the file name uses the date", () => {
  expect(exportFileName("2026-10-23")).toBe("nabad-data-2026-10-23.json");
});

test("the privacy policy explains the right to download your data", () => {
  const { container } = render(<PrivacyPolicy />);
  expect(screen.getByRole("heading", { name: "Your right to a copy of your data" })).toHaveAttribute("id", "download-your-data");
  expect(container).toHaveTextContent("You have the right to download a copy of the data Nabad stores about you.");
  expect(container).toHaveTextContent("Nabad emails you after every download");
});
