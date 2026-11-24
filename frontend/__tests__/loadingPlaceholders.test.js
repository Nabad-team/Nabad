// The loading rule (docs/design-system.md, "Loading placeholders"): pages show grey placeholders while their data
// loads, and the only animated loader is the Symptom check's while it is checking. These checks read the source,
// so a page that brings the old heartbeat loader back fails here.
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { LinesSkeleton, RowsSkeleton, CardsSkeleton, MedicationOverviewSkeleton } from "../components/ui/Skeleton";
import { inSentence } from "../components/ProfileCoverage";

const ROOT = path.join(__dirname, "..");
function sources(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(relative);
    return entry.name.endsWith(".js") ? [[relative, fs.readFileSync(path.join(ROOT, relative), "utf8")]] : [];
  });
}
const files = [...sources("pages"), ...sources("components")];

test("no page or component uses the old heartbeat loader, and the component is gone", () => {
  expect(files.filter(([, code]) => /HeartbeatLoader/.test(code)).map(([file]) => file)).toEqual([]);
  // Phase 2 of the Held refresh removed components/ui/Heartbeat.js altogether (the title bar replaced its line).
  expect(fs.existsSync(path.join(ROOT, "components", "ui", "Heartbeat.js"))).toBe(false);
});

test("the animated loader appears only on the Symptom check", () => {
  const users = files.filter(([file, code]) => /<HeldLoader\b|state="thinking"/.test(code) && !file.endsWith("HeldMark.js")).map(([file]) => file);
  expect(users).toEqual([path.join("pages", "symptoms.js")]);
});

test.each([
  ["Medication overview", "pages/medication-overview.js", "MedicationOverviewSkeleton"],
  ["Water and sleep", "pages/water-and-sleep.js", "CardsSkeleton"],
  ["Visit preparation", "pages/visit-prep.js", "CardsSkeleton"],
  ["Care circle", "pages/care-circle/index.js", "CardsSkeleton"],
  ["Notifications", "pages/notifications.js", "RowsSkeleton"],
  ["My profile", "pages/profile.js", "CardsSkeleton"],
  ["Account security", "pages/security.js", "LinesSkeleton"],
  ["Emergency card", "pages/emergency-card.js", "CardsSkeleton"],
  ["Health assistant", "pages/health-assistant.js", "LinesSkeleton"],
])("%s loads with a placeholder", (_, file, component) => {
  expect(fs.readFileSync(path.join(ROOT, file), "utf8")).toContain(`<${component} `);
});

test.each([
  ["lines", <LinesSkeleton label="Loading your saved chats..." lines={3} button />],
  ["rows", <RowsSkeleton label="Loading notifications..." />],
  ["cards", <CardsSkeleton label="Loading your care circle..." count={3} grid title />],
  ["overview", <MedicationOverviewSkeleton label="Loading the medication overview..." />],
])("the %s placeholder is announced once and hides its shapes", (_, element) => {
  const { container } = render(element);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(container.querySelector(".skeleton__shapes")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector(".skeleton__shapes button, .skeleton__shapes a, .skeleton__shapes input")).toBeNull();
});

test("labels inside a sentence keep acronyms: Upload patient ID, Upload NSSF document", () => {
  expect(`Upload ${inSentence("Patient ID")}`).toBe("Upload patient ID");
  expect(`Upload ${inSentence("NSSF document")}`).toBe("Upload NSSF document");
  expect(`Upload ${inSentence("Medical insurance card")}`).toBe("Upload medical insurance card");
});
