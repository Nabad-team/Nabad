// SCRUM-156: asking questions about your own history.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyHistoryPage, { EXAMPLES } from "../pages/my-history";
import { askHistory } from "../lib/historyApi";
import { useActiveProfile } from "../context/ActiveProfileContext";

jest.mock("../lib/historyApi", () => ({ askHistory: jest.fn() }));
jest.mock("../components/ProfileHeader", () => () => <header>Navigation</header>);
jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));

const SEARCH = {
  answer: 'The most recent one mentioning "headache": on 3 October 2026 you described: "bad headache behind my eyes" (result: See a doctor soon). There is 1 other below.',
  answeredBy: "search", period: null, kinds: ["symptoms", "visits"], total: 2, sources: [],
  records: [
    { type: "symptom-check", id: "aaaaaaaaaaaaaaaaaaaaaaaa", day: "2026-10-03", title: "Symptom check", detail: "bad headache behind my eyes", result: "See a doctor soon", href: "/symptoms" },
    { type: "visit", id: "bbbbbbbbbbbbbbbbbbbbbbbb", day: "2026-12-01", time: "10:00", title: "Neurology follow-up", detail: "AUBMC", result: "Upcoming", notes: "bring scan", href: "/appointments#appointment-bbbbbbbbbbbbbbbbbbbbbbbb" },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "self", fullName: "Rana", isSelf: true }, error: "" });
  askHistory.mockResolvedValue(SEARCH);
});

test("needs sign-in; asks the question for the active profile, without AI unless the box is ticked", async () => {
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  expect(MyHistoryPage.requireSignIn).toBe(true);
  await user.type(screen.getByLabelText("Your question"), "When did I last have a headache?");
  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(askHistory).toHaveBeenCalledWith("self", "When did I last have a headache?", false, expect.any(AbortSignal));
  const answer = await screen.findByRole("region", { name: "When did I last have a headache?" });
  expect(answer).toHaveTextContent(SEARCH.answer);
  expect(answer).toHaveTextContent("Found by searching the saved records.");
  expect(answer).toHaveTextContent("It is not medical advice.");
});

test("lists every record found, with its date, what was said and a link to it", async () => {
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  await user.type(screen.getByLabelText("Your question"), "headache");
  await user.click(screen.getByRole("button", { name: "Ask" }));
  const records = await screen.findByRole("list", { name: "Records found" });
  const [check, visit] = within(records).getAllByRole("listitem");
  expect(check).toHaveTextContent("Symptom check3 October 2026See a doctor soon");
  expect(check).toHaveTextContent("You described: “bad headache behind my eyes”");
  expect(within(check).getByRole("link", { name: "Open symptom checks" })).toHaveAttribute("href", "/symptoms");
  expect(visit).toHaveTextContent("1 December 2026, 10:00Upcoming");
  expect(visit).toHaveTextContent("Notes: bring scan");
  expect(within(visit).getByRole("link", { name: "Open in Appointments" })).toHaveAttribute("href", "/appointments#appointment-bbbbbbbbbbbbbbbbbbbbbbbb");
  expect(screen.getByRole("heading", { name: "2 records" })).toBeInTheDocument();
});

test("with AI: says so, and marks the records the answer used", async () => {
  askHistory.mockResolvedValue({ ...SEARCH, answeredBy: "ai", answer: "Your last headache check was on 3 October 2026.", sources: ["aaaaaaaaaaaaaaaaaaaaaaaa"] });
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  await user.click(screen.getByRole("checkbox", { name: /Let AI write the answer/ }));
  await user.type(screen.getByLabelText("Your question"), "headache");
  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(askHistory).toHaveBeenCalledWith("self", "headache", true, expect.any(AbortSignal));
  expect(await screen.findByText("Written by AI from the records below. Check them: AI can make mistakes.", { exact: false })).toBeInTheDocument();
  const [check, visit] = within(screen.getByRole("list", { name: "Records found" })).getAllByRole("listitem");
  expect(within(check).getByText("Used in the answer")).toBeInTheDocument();
  expect(within(visit).queryByText("Used in the answer")).not.toBeInTheDocument();
});

test("an example question can be asked with one tap", async () => {
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  await user.click(screen.getByRole("button", { name: EXAMPLES[1] }));
  expect(askHistory).toHaveBeenCalledWith("self", EXAMPLES[1], false, expect.any(AbortSignal));
  expect(screen.getByLabelText("Your question")).toHaveValue(EXAMPLES[1]);
});

test("an emergency described now shows the call-140 message first", async () => {
  askHistory.mockResolvedValue({ ...SEARCH, safety: { message: "If this is happening now, call 140 (Lebanese Red Cross) or go to the nearest emergency department.", phone: "140" } });
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  await user.type(screen.getByLabelText("Your question"), "I have chest pain now, did I have this before?");
  await user.click(screen.getByRole("button", { name: "Ask" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Is this happening now?");
  expect(within(alert).getByRole("link", { name: "Call 140" })).toHaveAttribute("href", "tel:140");
});

test("nothing found, too short, and errors", async () => {
  askHistory.mockResolvedValueOnce({ ...SEARCH, records: [], total: 0, answer: "I couldn't find any symptom checks or visits mentioning \"nosebleed\" in your Nabad history." });
  const user = userEvent.setup({ delay: null });
  render(<MyHistoryPage />);
  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Write a question of at least 3 characters.");
  await user.type(screen.getByLabelText("Your question"), "nosebleed");
  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(await screen.findByText(/I couldn't find any/)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Records found" })).not.toBeInTheDocument();
  askHistory.mockRejectedValueOnce(new Error("You have asked a lot of questions in a short time. Please wait a few minutes and try again."));
  await user.click(screen.getByRole("button", { name: "Ask" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("asked a lot of questions");
});

test("for a family member, it says whose history it is", () => {
  useActiveProfile.mockReturnValue({ activeProfile: { id: "child-1", fullName: "Sami", isSelf: false }, error: "" });
  render(<MyHistoryPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Ask about Sami's history" })).toBeInTheDocument();
});
