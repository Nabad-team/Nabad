// SCRUM-332: "My health story", month by month on /my-history, with filters and links.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HealthStory from "../components/HealthStory";
import { getHealthStory } from "../lib/historyApi";

jest.mock("../lib/historyApi", () => ({ getHealthStory: jest.fn() }));

const NOVEMBER = {
  month: "2026-11", label: "November 2026",
  counts: { "symptom-check": 1, appointment: 1, medication: 0, document: 1, vitals: 1 },
  events: [
    { type: "appointment", id: "a1", day: "2026-11-25", time: "10:30", title: "Cardiology follow-up", detail: "AUBMC, Hamra", badge: "Upcoming", href: "/appointments#appointment-a1" },
    { type: "vitals", id: "vitals-2026-11-04", day: "2026-11-04", time: "19:00", title: "3 vitals readings", detail: "Latest: Blood pressure 138/88, heart rate 88", badge: "", href: "/vitals" },
    { type: "symptom-check", id: "s1", day: "2026-11-01", time: "01:30", title: "Symptom check", detail: "chest pain when climbing stairs", badge: "Urgent", attention: true, href: "/symptoms" },
    { type: "document", id: "d1", day: "2026-11-01", time: "", title: "letter.pdf", detail: "Letter", badge: "", href: "/medical-documents#document-d1" },
  ],
};
const SEPTEMBER = {
  month: "2026-09", label: "September 2026",
  counts: { "symptom-check": 0, appointment: 0, medication: 2, document: 0, vitals: 0 },
  events: [
    { type: "medication", id: "m1-stopped", day: "2026-09-17", title: "Stopped Amoxicillin", detail: "500 mg, 3 times a day", badge: "", href: "/medications#medication-m1" },
    { type: "medication", id: "m1-started", day: "2026-09-10", title: "Started Amoxicillin", detail: "500 mg, 3 times a day", badge: "", href: "/medications#medication-m1" },
  ],
};
const STORY = {
  from: "2026-06", until: "2026-11", months: [NOVEMBER, SEPTEMBER],
  counts: { "symptom-check": 1, appointment: 1, medication: 2, document: 1, vitals: 1 },
  hasEarlier: true, earlierUntil: "2026-05", truncated: false,
};
const EARLIER = {
  from: "2025-12", until: "2026-05",
  months: [{ month: "2026-02", label: "February 2026", counts: { "symptom-check": 1, appointment: 0, medication: 0, document: 0, vitals: 0 },
    events: [{ type: "symptom-check", id: "s0", day: "2026-02-01", time: "10:00", title: "Symptom check", detail: "a very old cough", badge: "Routine / self-care", href: "/symptoms" }] }],
  counts: { "symptom-check": 1, appointment: 0, medication: 0, document: 0, vitals: 0 },
  hasEarlier: false, earlierUntil: null, truncated: false,
};

beforeEach(() => {
  jest.resetAllMocks();
  getHealthStory.mockResolvedValue(STORY);
});

test("shows the months newest first, each event with its date, kind, detail and a link to it", async () => {
  render(<HealthStory profileId="self" />);
  expect(getHealthStory).toHaveBeenCalledWith("self", { until: undefined }, expect.any(AbortSignal));
  const november = await screen.findByRole("region", { name: "November 2026" });
  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["November 2026", "September 2026"]);
  expect(november).toHaveTextContent("1 symptom check, 1 appointment, 1 document, 1 day of vitals");
  expect(screen.getByText("Showing June 2026 to November 2026")).toBeInTheDocument();

  const [visit, vitals, check, letter] = within(within(november).getByRole("list")).getAllByRole("listitem");
  expect(visit).toHaveTextContent("Appointment25 November 2026, 10:30Upcoming");
  expect(visit).toHaveTextContent("AUBMC, Hamra");
  expect(within(visit).getByRole("link", { name: "Open in Appointments" })).toHaveAttribute("href", "/appointments#appointment-a1");
  expect(within(vitals).getByRole("link", { name: "Open in My vitals" })).toHaveAttribute("href", "/vitals");
  expect(check).toHaveTextContent("You described: “chest pain when climbing stairs”");
  expect(within(check).getByText("Urgent")).toHaveClass("badge--warning");
  expect(within(letter).getByRole("link", { name: "Open in Medical documents" })).toHaveAttribute("href", "/medical-documents#document-d1");

  const september = screen.getByRole("region", { name: "September 2026" });
  expect(september).toHaveTextContent("2 medication changes");
  expect(within(september).getAllByRole("listitem").map((item) => item.querySelector(".history-record__title").textContent)).toEqual(["Stopped Amoxicillin", "Started Amoxicillin"]);
  expect(within(september).getAllByRole("link", { name: "Open in Medications" })[0]).toHaveAttribute("href", "/medications#medication-m1");
});

test("filters hide and show kinds of records, with their counts, without asking the server again", async () => {
  const user = userEvent.setup({ delay: null });
  render(<HealthStory profileId="self" />);
  await screen.findByRole("region", { name: "November 2026" });
  const filters = screen.getByRole("group", { name: "Show" });
  expect(within(filters).getAllByRole("checkbox").map((box) => box.parentElement.textContent)).toEqual([
    "Symptom checks (1)", "Appointments (1)", "Medication changes (2)", "Documents (1)", "Vitals (1)",
  ]);

  await user.click(screen.getByRole("checkbox", { name: "Medication changes (2)" }));
  expect(screen.queryByRole("region", { name: "September 2026" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "November 2026" })).toBeInTheDocument();

  for (const name of ["Symptom checks (1)", "Appointments (1)", "Documents (1)", "Vitals (1)"]) await user.click(screen.getByRole("checkbox", { name }));
  expect(screen.getByText("Nothing to show with these filters. Tick a kind of record above.")).toBeInTheDocument();

  await user.click(screen.getByRole("checkbox", { name: "Symptom checks (1)" }));
  const november = screen.getByRole("region", { name: "November 2026" });
  expect(within(november).getAllByRole("listitem")).toHaveLength(1);
  expect(november).toHaveTextContent("1 symptom check");
  expect(november).not.toHaveTextContent("appointment");
  expect(getHealthStory).toHaveBeenCalledTimes(1);
});

test("Show earlier months adds the months before, and goes away when there are no more", async () => {
  const user = userEvent.setup({ delay: null });
  getHealthStory.mockResolvedValueOnce(STORY).mockResolvedValueOnce(EARLIER);
  render(<HealthStory profileId="self" />);
  await user.click(await screen.findByRole("button", { name: "Show earlier months" }));
  expect(getHealthStory).toHaveBeenLastCalledWith("self", { until: "2026-05" }, expect.any(AbortSignal));
  expect(await screen.findByRole("region", { name: "February 2026" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["November 2026", "September 2026", "February 2026"]);
  expect(screen.getByText("Showing December 2025 to November 2026")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Symptom checks (2)" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show earlier months" })).not.toBeInTheDocument();
});

test("for a family member, it names them; with nothing saved, it says so", async () => {
  getHealthStory.mockResolvedValue({ ...STORY, months: [], counts: {}, hasEarlier: false, earlierUntil: null });
  render(<HealthStory profileId="child-1" forSelf={false} name="Sami" />);
  expect(screen.getByRole("heading", { level: 2, name: "Sami's health story" })).toBeInTheDocument();
  expect(await screen.findByText(/Nothing saved yet: Sami's symptom checks/)).toBeInTheDocument();
  expect(getHealthStory).toHaveBeenCalledWith("child-1", { until: undefined }, expect.any(AbortSignal));
});

test("a family member's symptom check says who described it", async () => {
  render(<HealthStory profileId="child-1" forSelf={false} name="Sami" />);
  expect(await screen.findByText("Sami described: “chest pain when climbing stairs”")).toBeInTheDocument();
});

test("a failure is shown", async () => {
  getHealthStory.mockRejectedValue(new Error("Too many requests. Please wait a few minutes and try again."));
  render(<HealthStory profileId="self" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
});

test("switching profile loads the other profile's story and never shows the old one under the new name", async () => {
  let finish;
  getHealthStory.mockResolvedValueOnce(STORY).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { rerender } = render(<HealthStory profileId="self" />);
  await screen.findByRole("region", { name: "November 2026" });
  rerender(<HealthStory profileId="child-1" forSelf={false} name="Sami" />);
  expect(screen.queryByRole("region", { name: "November 2026" })).not.toBeInTheDocument();
  finish({ ...STORY, months: [SEPTEMBER] });
  expect(await screen.findByRole("region", { name: "September 2026" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "November 2026" })).not.toBeInTheDocument();
});
