// SCRUM-333: "Questions for my doctor": the list on Visit preparation and the small card on other pages.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DoctorQuestions, { QuickDoctorQuestion, questionsSectionText } from "../components/DoctorQuestions";
import { addDoctorQuestion, editDoctorQuestion, removeDoctorQuestion } from "../lib/visitPrepApi";

jest.mock("../lib/visitPrepApi", () => ({ addDoctorQuestion: jest.fn(), editDoctorQuestion: jest.fn(), removeDoctorQuestion: jest.fn() }));

const Q1 = { id: "q1", text: "Should I keep taking ibuprofen?" };
const Q2 = { id: "q2", text: "Do I need a blood test?" };

beforeEach(() => jest.resetAllMocks());

test("the section text is numbered, one question per line", () => {
  expect(questionsSectionText([Q1, Q2])).toBe("1. Should I keep taking ibuprofen?\n2. Do I need a blood test?");
  expect(questionsSectionText([])).toBe("");
});

test("lists the questions in order and adds one", async () => {
  const user = userEvent.setup({ delay: null });
  const onChange = jest.fn();
  addDoctorQuestion.mockResolvedValue({ question: Q2, questions: [Q1, Q2] });
  render(<DoctorQuestions profileId="self" questions={[Q1]} onChange={onChange} />);
  const list = screen.getByRole("list", { name: "Questions for my doctor" });
  expect(within(list).getAllByRole("listitem").map((item) => item.querySelector(".doctor-questions__text").textContent)).toEqual([Q1.text]);

  await user.type(screen.getByLabelText("Add a question"), "  Do I need a   blood test?  ");
  await user.click(screen.getByRole("button", { name: "Save question" }));
  expect(addDoctorQuestion).toHaveBeenCalledWith("self", "Do I need a blood test?");
  expect(onChange).toHaveBeenCalledWith([Q1, Q2]);
  expect(screen.getByLabelText("Add a question")).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("Question saved.");
});

test("an empty question is not sent; a server error is shown", async () => {
  const user = userEvent.setup({ delay: null });
  render(<DoctorQuestions profileId="self" questions={[]} />);
  expect(screen.getByText("No questions yet.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save question" }));
  expect(addDoctorQuestion).not.toHaveBeenCalled();
  expect(screen.getByText("Write your question first.")).toBeInTheDocument();
  addDoctorQuestion.mockRejectedValue(new Error("You can keep up to 30 questions for this profile. Remove one you no longer need first."));
  await user.type(screen.getByLabelText("Add a question"), "One more?");
  await user.click(screen.getByRole("button", { name: "Save question" }));
  expect(await screen.findByText(/up to 30 questions/)).toBeInTheDocument();
  expect(screen.getByLabelText("Add a question")).toHaveValue("One more?");
});

test("edits and removes a question", async () => {
  const user = userEvent.setup({ delay: null });
  const onChange = jest.fn();
  editDoctorQuestion.mockResolvedValue({ question: { ...Q1, text: "Should I stop ibuprofen?" }, questions: [{ ...Q1, text: "Should I stop ibuprofen?" }, Q2] });
  removeDoctorQuestion.mockResolvedValue({ questions: [Q1] });
  render(<DoctorQuestions profileId="self" questions={[Q1, Q2]} onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: `Edit: ${Q1.text}` }));
  const field = screen.getByLabelText("Edit question");
  expect(field).toHaveValue(Q1.text);
  await user.clear(field);
  await user.type(field, "Should I stop ibuprofen?");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(editDoctorQuestion).toHaveBeenCalledWith("self", "q1", "Should I stop ibuprofen?");
  expect(onChange).toHaveBeenLastCalledWith([{ ...Q1, text: "Should I stop ibuprofen?" }, Q2]);
  expect(await screen.findByText("Question updated.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: `Remove: ${Q2.text}` }));
  expect(removeDoctorQuestion).toHaveBeenCalledWith("self", "q2");
  expect(onChange).toHaveBeenLastCalledWith([Q1]);
  expect(await screen.findByText("Question removed.")).toBeInTheDocument();
});

test("the small card saves a question for the active profile and points to Visit preparation", async () => {
  const user = userEvent.setup({ delay: null });
  addDoctorQuestion.mockResolvedValue({ question: Q1, questions: [Q1, Q2] });
  render(<QuickDoctorQuestion profileId="child-1" forSelf={false} name="Sami" />);
  expect(screen.getByText(/ask at Sami's next visit/)).toBeInTheDocument();
  await user.type(screen.getByLabelText("Question for the doctor"), Q1.text);
  await user.click(screen.getByRole("button", { name: "Save question" }));
  expect(addDoctorQuestion).toHaveBeenCalledWith("child-1", Q1.text);
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Saved. You have 2 questions for the doctor.");
  expect(within(status).getByRole("link", { name: "See them in Visit preparation" })).toHaveAttribute("href", "/visit-prep#doctor-questions-heading");
});
