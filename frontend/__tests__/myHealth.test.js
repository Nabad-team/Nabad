// Automated tests for the "My health" page.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyHealthPage from "../pages/my-health";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import * as fake from "../test-utils/fakeHealthProfileApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/healthProfileApi", () => require("../test-utils/fakeHealthProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

function renderPage() {
  return render(
    <ActiveProfileProvider>
      <MyHealthPage />
    </ActiveProfileProvider>
  );
}
const region = (name) => screen.findByRole("region", { name });
const row = async (listName, text) => within(await screen.findByRole("list", { name: listName })).getByText(text).closest("li");
const summary = async () => (await region("What Nabad's guidance takes into account")).querySelector("pre");

describe("My health page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    fake.resetFakeHealth();
  });

  test("starts empty and calm: the intro, a gentle count, nothing to review, and every section optional", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "My health" })).toBeInTheDocument();
    expect(screen.getByText("Nabad uses this to give you safer guidance. Everything here is optional, and you can change it anytime.")).toBeInTheDocument();
    expect(await screen.findByText("Nabad knows you better: 0 of 5 basics filled in.")).toBeInTheDocument();
    expect(screen.queryByText(/incomplete|missing|required/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    expect(within(await region("Suggestions to review")).getByText(/Nothing to review/)).toBeInTheDocument();
    for (const name of ["Basics", "Long-term conditions", "Allergies", "Medications", "Lifestyle", "What Nabad's guidance takes into account"]) {
      expect(await region(name)).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Pregnancy" })).not.toBeInTheDocument();
    expect(await row("Basics", "Age")).toHaveTextContent("Not added");
    expect(within(await row("Basics", "Age")).getByRole("link", { name: "Add your date of birth" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Add sex assigned at birth" })).toBeInTheDocument();
    expect(screen.getByText("No allergies added.")).toBeInTheDocument();
    expect(screen.getByText("No current medications.")).toBeInTheDocument();
    expect(await summary()).toHaveTextContent(/^Age: not recorded/);
  });

  test("adds, changes and removes basics, each showing where it came from, and the count follows", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedAge("self", "1992-05-02", 34);
    renderPage();
    expect(await row("Basics", "Age")).toHaveTextContent("34 years");
    expect(await row("Basics", "Age")).toHaveTextContent("From the date of birth, 2 May 1992");
    expect(screen.getByText("Nabad knows you better: 1 of 5 basics filled in.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add sex assigned at birth" }));
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const sex = await row("Basics", "Sex assigned at birth");
    expect(within(sex).getByText("Female")).toBeInTheDocument();
    expect(within(sex).getByText(/^You added this, 12 Oct/)).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["addHealthFact", "self", "sex", "female"]);

    await user.click(screen.getByRole("button", { name: "Add height" }));
    await user.type(screen.getByLabelText("Height (cm)"), "172");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Basics", "Height")).toHaveTextContent("172 cm");

    await user.click(screen.getByRole("button", { name: "Add weight" }));
    await user.type(screen.getByLabelText("Weight (kg)"), "72.5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Basics", "Weight")).toHaveTextContent("72.5 kg");
    expect(fake.calls).toContainEqual(["addHealthFact", "self", "weight", 72.5]);

    await user.click(screen.getByRole("button", { name: "Add blood type" }));
    await user.selectOptions(screen.getByLabelText("Blood type"), "I don't know");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Basics", "Blood type")).toHaveTextContent("I don't know");
    expect(await screen.findByText("All 5 basics are filled in. Thank you: Nabad knows you better.")).toBeInTheDocument();

    // Changing keeps one value; removing brings back "Add".
    await user.click(screen.getByRole("button", { name: "Change blood type" }));
    expect(screen.getByLabelText("Blood type")).toHaveValue("unknown");
    await user.selectOptions(screen.getByLabelText("Blood type"), "O+");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Basics", "Blood type")).toHaveTextContent("O+");
    expect(fake.fakeFacts("self").filter((f) => f.category === "bloodType")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Remove height" }));
    expect(await screen.findByRole("button", { name: "Add height" })).toBeInTheDocument();
    expect(screen.getByText("Nabad knows you better: 4 of 5 basics filled in.")).toBeInTheDocument();
  });

  test("checks numbers before saving, in the same words as the server", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add height" }));
    await user.type(screen.getByLabelText("Height (cm)"), "17.5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Height (cm)")).toHaveAccessibleDescription("Enter a height in whole centimetres, from 30 to 250.");
    expect(screen.getByLabelText("Height (cm)")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Add sex assigned at birth" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose one of the options.")).toBeInTheDocument();
    expect(fake.calls.filter(([name]) => name === "addHealthFact")).toEqual([]);
  });

  test("asks about pregnancy only when it can apply", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedAge("self", "1992-05-02", 34);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add sex assigned at birth" }));
    await user.click(screen.getByRole("radio", { name: "Male" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await row("Basics", "Male");
    expect(screen.queryByRole("region", { name: "Pregnancy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change sex assigned at birth" }));
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const pregnancy = await region("Pregnancy");
    await user.click(within(pregnancy).getByRole("button", { name: "Add pregnancy" }));
    await user.click(screen.getByRole("radio", { name: "Pregnant" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Pregnancy", "Pregnant")).toHaveTextContent(/You added this/);
  });

  test("hides pregnancy for a woman over 55", async () => {
    fake.seedAge("self", "1960-01-01", 66);
    fake.seedFact("self", "sex", "female");
    renderPage();
    await row("Basics", "Female");
    expect(screen.queryByRole("region", { name: "Pregnancy" })).not.toBeInTheDocument();
  });

  test("conditions: tick from the checklist, untick to remove, and add others in your own words", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const conditions = await region("Long-term conditions");
    for (const name of ["Diabetes", "High blood pressure", "Asthma", "Heart disease", "Kidney disease", "Epilepsy", "Thyroid disease"]) {
      expect(within(conditions).getByRole("checkbox", { name })).not.toBeChecked();
    }
    await user.click(within(conditions).getByRole("checkbox", { name: "Diabetes" }));
    const diabetes = await within(conditions).findByRole("checkbox", { name: "Diabetes", checked: true });
    expect(diabetes).toHaveAccessibleDescription(/^You added this, 12 Oct/);
    expect(fake.calls).toContainEqual(["addHealthFact", "self", "condition", { code: "diabetes" }]);
    expect(await summary()).toHaveTextContent("Long-term conditions: diabetes");

    await user.click(screen.getByRole("button", { name: "Add another condition" }));
    await user.type(screen.getByLabelText("Condition"), "Migraine");
    await user.click(screen.getByRole("button", { name: "Save condition" }));
    expect(await row("Other conditions", "Migraine")).toHaveTextContent(/You added this/);
    await user.click(screen.getByRole("button", { name: "Change Migraine" }));
    await user.clear(screen.getByLabelText("Condition"));
    await user.type(screen.getByLabelText("Condition"), "Chronic migraine");
    await user.click(screen.getByRole("button", { name: "Save condition" }));
    expect(await row("Other conditions", "Chronic migraine")).toBeInTheDocument();
    expect(await summary()).toHaveTextContent("Long-term conditions: diabetes; Chronic migraine");

    await user.click(screen.getByRole("checkbox", { name: "Diabetes" }));
    expect(await screen.findByRole("checkbox", { name: "Diabetes", checked: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Chronic migraine" }));
    expect(await summary()).toHaveTextContent("Long-term conditions: none recorded");
    expect(fake.fakeFacts("self")).toEqual([]);
  });

  test("allergies: what to, the kind and an optional reaction, then change and remove", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add an allergy" }));
    await user.click(screen.getByRole("button", { name: "Save allergy" }));
    expect(screen.getByText("Choose what the allergy is to: a medication, a food or something else.")).toBeInTheDocument();
    expect(screen.getByLabelText("Allergic to")).toHaveAccessibleDescription(/Enter what you are allergic to\./);

    await user.click(screen.getByRole("radio", { name: "Medication" }));
    await user.type(screen.getByLabelText("Allergic to"), "Penicillin");
    await user.type(screen.getByLabelText("Reaction (optional)"), "Rash");
    await user.click(screen.getByRole("button", { name: "Save allergy" }));
    const penicillin = await row("Allergies", "Penicillin · reaction: Rash");
    expect(penicillin).toHaveTextContent("Medication");
    expect(penicillin).toHaveTextContent(/You added this, 12 Oct/);
    expect(fake.calls).toContainEqual(["addHealthFact", "self", "allergy", { type: "medication", name: "Penicillin", reaction: "Rash" }]);

    await user.click(screen.getByRole("button", { name: "Change Penicillin" }));
    expect(screen.getByRole("radio", { name: "Medication" })).toBeChecked();
    await user.clear(screen.getByLabelText("Reaction (optional)"));
    await user.click(screen.getByRole("button", { name: "Save allergy" }));
    expect(await row("Allergies", "Penicillin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Penicillin" }));
    expect(await screen.findByText("No allergies added.")).toBeInTheDocument();
  });

  test("shows the current medications read only, with a link to manage them", async () => {
    fake.seedMedication("self", { name: "Metformin", dose: "500", unit: "mg", frequency: "Twice a day" });
    renderPage();
    const medications = await region("Medications");
    const metformin = await row("Current medications", "Metformin");
    expect(metformin).toHaveTextContent("500 mg · Twice a day");
    expect(within(metformin).queryByRole("button")).not.toBeInTheDocument();
    expect(within(medications).getByRole("link", { name: "Manage medications" })).toHaveAttribute("href", "/medications");
  });

  test("smoking, under lifestyle", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add smoking" }));
    for (const name of ["Never smoked", "Used to smoke", "Smokes now"]) expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Used to smoke" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await row("Lifestyle", "Used to smoke")).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["addHealthFact", "self", "smoking", "former"]);
  });

  test("suggestions wait to be confirmed or dismissed, with where they came from", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedFact("self", "bloodType", "unknown");
    const bloodType = fake.seedSuggestion("self", "bloodType", "O+");
    const anaemia = fake.seedSuggestion("self", "condition", { code: "other", text: "Anaemia" });
    renderPage();
    const suggestions = await row("Suggestions to review", "O+");
    expect(suggestions).toHaveTextContent("Blood type");
    expect(suggestions).toHaveTextContent(/Suggested from a lab report, 12 Oct/);
    expect(await summary()).not.toHaveTextContent("Anaemia");

    await user.click(screen.getByRole("button", { name: "Confirm O+" }));
    expect(await row("Basics", "O+")).toHaveTextContent(/From a lab report, 12 Oct/);
    expect(fake.calls).toContainEqual(["confirmSuggestion", "self", bloodType.id]);
    await user.click(screen.getByRole("button", { name: "Dismiss Anaemia" }));
    expect(within(await region("Suggestions to review")).getByText(/Nothing to review/)).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["dismissSuggestion", "self", anaemia.id]);
  });

  test("shows the summary Nabad's guidance uses, exactly as the server sends it", async () => {
    fake.seedAge("self", "1992-05-02", 34);
    fake.seedFact("self", "sex", "female");
    fake.seedFact("self", "allergy", { type: "food", name: "Peanuts", reaction: "" });
    renderPage();
    expect((await summary()).textContent).toBe([
      "Age: 34 years", "Sex assigned at birth: female", "Long-term conditions: none recorded",
      "Allergies: Peanuts (food)", "Current medications: none recorded",
    ].join("\n"));
  });

  test("follows the header profile switcher, and keeps each person's information apart", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fake.seedFact("self", "allergy", { type: "food", name: "Peanuts", reaction: "" });
    fake.seedAge(child.id, "2018-04-02", 8);
    fake.seedFact(child.id, "condition", { code: "asthma" });
    renderPage();
    expect(await row("Allergies", "Peanuts")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Active profile"), child.id);
    expect(await screen.findByRole("heading", { level: 1, name: "Health for Sami Haddad" })).toBeInTheDocument();
    expect(screen.getByText("Acting as: Sami Haddad (child)")).toBeInTheDocument();
    expect(screen.getByText(/Nabad uses this to give safer guidance for Sami Haddad\./)).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: "Asthma", checked: true })).toBeInTheDocument();
    expect(screen.getByText("No allergies added.")).toBeInTheDocument();
    expect(screen.getByText("Nabad knows Sami Haddad better: 1 of 5 basics filled in.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Does Sami Haddad have any of these?" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Epilepsy" }));
    expect(await screen.findByRole("checkbox", { name: "Epilepsy", checked: true })).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["addHealthFact", child.id, "condition", { code: "epilepsy" }]);
    expect(fake.fakeFacts("self")).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText("Active profile"), "self");
    expect(await screen.findByRole("heading", { level: 1, name: "My health" })).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: "Epilepsy", checked: false })).toBeInTheDocument();
    expect(await row("Allergies", "Peanuts")).toBeInTheDocument();
  });

  test("shows the server's message in the form, for example when another tab saved first", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add blood type" }));
    await user.selectOptions(screen.getByLabelText("Blood type"), "A+");
    fake.seedFact("self", "bloodType", "B+"); // saved in another tab meanwhile
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This is already recorded. Change or remove it instead.")).toBeInTheDocument();
    expect(screen.getByLabelText("Blood type")).toHaveAccessibleDescription(/This is already recorded/);
  });

  test("a load failure shows a calm message and Try again", async () => {
    const user = userEvent.setup({ delay: null });
    fake.failFakeHealthLoading();
    renderPage();
    expect(await screen.findByText("We couldn't load this health information. Please check your connection and try again.")).toBeInTheDocument();
    fake.resetFakeHealth();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Nabad knows you better: 0 of 5 basics filled in.")).toBeInTheDocument();
  });

  test("has the page title and a header link, and is only for signed-in users", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "My health" })).toHaveAttribute("href", "/my-health");
    expect(MyHealthPage.requireSignIn).toBe(true);
  });
});
