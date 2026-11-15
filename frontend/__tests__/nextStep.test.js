// The dashboard's Next step: which line wins, and Beirut time around midnight.
// November 2026: Beirut is UTC+2, so 21:30 UTC is 23:30 in Beirut and 22:30 UTC is 00:30 the next day.
import { render, screen } from "@testing-library/react";
import { pickNextStep } from "../lib/nextStep";
import NextStepCard from "../components/NextStepCard";

const amlodipine = { id: "m1", name: "Amlodipine", dose: "5", unit: "mg", times: ["08:00"], taken: false };
const cardiology = { id: "a1", title: "Cardiology check-up", hospital: "AUBMC", appointmentDate: "2026-11-20", appointmentTime: "10:00" };
const allClear = { medications: [], appointments: [], basicsFilled: 5, wellbeing: { sleep: { hours: 7, quality: 4 } } };
const at = (iso) => new Date(iso);

describe("pickNextStep", () => {
  test("1. a dose due in the next 3 hours wins over everything else", () => {
    const step = pickNextStep({ ...allClear, medications: [amlodipine], appointments: [cardiology], basicsFilled: 2, wellbeing: { sleep: null }, now: at("2026-11-19T04:15:00Z") }); // 06:15 Beirut
    expect(step).toEqual({ kind: "medication", text: "Take Amlodipine 5 mg at 08:00", action: "Open medications", href: "/medications" });
  });

  test("1. just before midnight in Beirut, a 00:30 dose is due tomorrow even if today's check-in is ticked", () => {
    const late = { ...amlodipine, times: ["00:30"], taken: true };
    const step = pickNextStep({ ...allClear, medications: [late], now: at("2026-11-19T21:30:00Z") }); // 23:30 Beirut
    expect(step.text).toBe("Take Amlodipine 5 mg at 00:30");
  });

  test("1. a once-a-day dose already checked off today, a dose more than 3 hours away and a past dose don't count", () => {
    const now = at("2026-11-19T04:15:00Z"); // 06:15 Beirut
    expect(pickNextStep({ ...allClear, medications: [{ ...amlodipine, taken: true }], now })).toBeNull();
    expect(pickNextStep({ ...allClear, medications: [{ ...amlodipine, times: ["09:30"] }], now })).toBeNull();
    expect(pickNextStep({ ...allClear, medications: [{ ...amlodipine, times: ["06:00"] }], now })).toBeNull();
    // Twice a day: today's tick can't say which dose, so the next one still shows.
    expect(pickNextStep({ ...allClear, medications: [{ ...amlodipine, times: ["08:00", "20:00"], taken: true }], now }).kind).toBe("medication");
  });

  test("1. the earliest dose is chosen", () => {
    const meds = [{ ...amlodipine, times: ["09:00"] }, { id: "m2", name: "Metformin", dose: "500", unit: "mg", times: ["07:00"], taken: false }];
    expect(pickNextStep({ ...allClear, medications: meds, now: at("2026-11-19T04:15:00Z") }).text).toBe("Take Metformin 500 mg at 07:00");
  });

  test("2. an appointment in the next 3 days, named by its Beirut weekday", () => {
    const step = pickNextStep({ ...allClear, appointments: [cardiology], basicsFilled: 2, now: at("2026-11-17T22:30:00Z") }); // Wed 18 Nov, 00:30 Beirut
    expect(step).toEqual({ kind: "appointment", text: "Cardiology check-up on Friday: prepare your visit", action: "Prepare visit", href: "/visit-prep" });
  });

  test("2. just after midnight in Beirut, a visit later that morning is 'today' (it is still the day before in UTC)", () => {
    const morning = { ...cardiology, appointmentDate: "2026-11-18", appointmentTime: "09:00" };
    expect(pickNextStep({ ...allClear, appointments: [morning], now: at("2026-11-17T22:30:00Z") }).text).toBe("Cardiology check-up today: prepare your visit");
    const tomorrow = { ...cardiology, appointmentDate: "2026-11-19", appointmentTime: "09:00" };
    expect(pickNextStep({ ...allClear, appointments: [tomorrow], now: at("2026-11-17T22:30:00Z") }).text).toBe("Cardiology check-up tomorrow: prepare your visit");
  });

  test("2. appointments more than 3 days away or already past don't count", () => {
    const now = at("2026-11-17T22:30:00Z"); // Wed 18 Nov, 00:30 Beirut
    const later = { ...cardiology, appointmentDate: "2026-11-21", appointmentTime: "09:00" };
    const past = { ...cardiology, appointmentDate: "2026-11-17", appointmentTime: "23:00" };
    expect(pickNextStep({ ...allClear, appointments: [later, past], now })).toBeNull();
  });

  test("3. health basics not all filled in", () => {
    expect(pickNextStep({ ...allClear, basicsFilled: 4, wellbeing: { sleep: null }, now: at("2026-11-19T10:00:00Z") }))
      .toEqual({ kind: "health", text: "Add your health basics for safer guidance", action: "Open my health", href: "/my-health" });
  });

  test("4. no sleep logged today", () => {
    expect(pickNextStep({ ...allClear, wellbeing: { sleep: null }, now: at("2026-11-19T22:05:00Z") })) // 00:05 Beirut, a new day
      .toEqual({ kind: "sleep", text: "Log last night's sleep", action: "Log sleep", href: "/water-and-sleep" });
  });

  test("hidden when nothing applies, or when the data couldn't load", () => {
    expect(pickNextStep({ ...allClear, now: at("2026-11-19T21:30:00Z") })).toBeNull();
    expect(pickNextStep({ medications: null, appointments: null, basicsFilled: null, wellbeing: null, now: at("2026-11-19T21:30:00Z") })).toBeNull();
  });

  test("acting for a linked profile names them in every line", () => {
    const forName = "Sami";
    const now = at("2026-11-17T22:30:00Z");
    expect(pickNextStep({ ...allClear, forName, medications: [{ ...amlodipine, times: ["02:00"] }], now }).text).toBe("Sami's Amlodipine 5 mg is due at 02:00");
    expect(pickNextStep({ ...allClear, forName, appointments: [cardiology], now }).text).toBe("Cardiology check-up for Sami on Friday: prepare the visit");
    expect(pickNextStep({ ...allClear, forName, basicsFilled: 1, now }).text).toBe("Add Sami's health basics for safer guidance");
    expect(pickNextStep({ ...allClear, forName, wellbeing: { sleep: null }, now }).text).toBe("Log Sami's sleep from last night");
  });
});

describe("NextStepCard", () => {
  const data = (fields) => ({ loaded: true, medications: [], appointments: [], health: { dateOfBirth: "1990-01-01", facts: [] }, wellbeing: { sleep: null }, ...fields });

  test("shows one line and one button", () => {
    render(<NextStepCard data={data()} now={at("2026-11-19T10:00:00Z")} />);
    const card = screen.getByRole("region", { name: "Next step" });
    expect(card).toHaveTextContent("Add your health basics for safer guidance");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open my health" })).toHaveAttribute("href", "/my-health");
  });

  test("waits until everything has loaded, and is hidden when nothing applies", () => {
    const { container, rerender } = render(<NextStepCard data={data({ loaded: false })} now={at("2026-11-19T10:00:00Z")} />);
    expect(container).toBeEmptyDOMElement();
    const done = { dateOfBirth: "1990-01-01", facts: ["sex", "height", "weight", "bloodType"].map((category) => ({ category })) };
    rerender(<NextStepCard data={data({ health: done, wellbeing: { sleep: { hours: 7 } } })} now={at("2026-11-19T10:00:00Z")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
