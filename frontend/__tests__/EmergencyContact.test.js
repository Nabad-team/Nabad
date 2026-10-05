import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmergencyContact from "../components/EmergencyContact";
import { getEmergencyContact, addEmergencyContact, updateEmergencyContact, removeEmergencyContact } from "../lib/api";
jest.mock("../lib/api",()=>({getEmergencyContact:jest.fn(),addEmergencyContact:jest.fn(),updateEmergencyContact:jest.fn(),removeEmergencyContact:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();getEmergencyContact.mockResolvedValue({contact:null});});
test("adds contact through the authenticated backend API",async()=>{
  const user=userEvent.setup(); addEmergencyContact.mockResolvedValue({contact:{name:"Family",phone:"71123456"}});
  render(<EmergencyContact/>);
  await user.type(await screen.findByLabelText("Contact name"),"Family");
  await user.type(screen.getByLabelText("Contact phone"),"71123456");
  await user.click(screen.getByRole("button",{name:"Save emergency contact"}));
  expect(addEmergencyContact).toHaveBeenCalledWith("Family","71123456");
  expect(await screen.findByText("Your emergency contact is saved.")).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Save emergency contact"})).not.toBeInTheDocument();
});
test("shows existing contact without offering to overwrite it",async()=>{
  getEmergencyContact.mockResolvedValue({contact:{name:"Existing",phone:"03123456"}});
  render(<EmergencyContact/>); expect(await screen.findByText("Existing")).toBeInTheDocument();
  expect(screen.queryByLabelText("Contact name")).not.toBeInTheDocument();
});
test("handles loading failure and allows retry",async()=>{
  getEmergencyContact.mockRejectedValueOnce(new Error("Unauthorized"));
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Retry loading contact"}));
  expect(await screen.findByLabelText("Contact name")).toBeInTheDocument();
});
test("shows backend validation error and keeps input for correction",async()=>{
  addEmergencyContact.mockRejectedValue(new Error("Invalid phone"));
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.type(await screen.findByLabelText("Contact name"),"Family");
  await user.type(screen.getByLabelText("Contact phone"),"bad");
  await user.click(screen.getByRole("button",{name:"Save emergency contact"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid phone");
  expect(screen.getByLabelText("Contact name")).toHaveValue("Family");
});

// Story #12: edit or remove the emergency contact.
const existing=()=>getEmergencyContact.mockResolvedValue({contact:{name:"Mom",phone:"71123456"}});
test("edit opens the form filled with the saved contact and saves the change",async()=>{
  existing(); updateEmergencyContact.mockResolvedValue({contact:{name:"Dad",phone:"03123456"}});
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Edit contact"}));
  expect(screen.getByLabelText("Contact name")).toHaveValue("Mom");
  expect(screen.getByLabelText("Contact phone")).toHaveValue("71123456");
  await user.clear(screen.getByLabelText("Contact name")); await user.type(screen.getByLabelText("Contact name"),"Dad");
  await user.clear(screen.getByLabelText("Contact phone")); await user.type(screen.getByLabelText("Contact phone"),"03123456");
  await user.click(screen.getByRole("button",{name:"Save changes"}));
  expect(updateEmergencyContact).toHaveBeenCalledWith("Dad","03123456");
  expect(addEmergencyContact).not.toHaveBeenCalled();
  expect(await screen.findByText("Dad")).toBeInTheDocument();
  expect(screen.getByText("Your emergency contact was updated.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Contact name")).not.toBeInTheDocument();
});
test("cancel leaves the saved contact unchanged",async()=>{
  existing(); const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Edit contact"}));
  await user.type(screen.getByLabelText("Contact name"),"zzz");
  await user.click(screen.getByRole("button",{name:"Cancel"}));
  expect(updateEmergencyContact).not.toHaveBeenCalled();
  expect(screen.getByText("Mom")).toBeInTheDocument();
});
test("a rejected edit keeps the form open with the typed values",async()=>{
  existing(); updateEmergencyContact.mockRejectedValue(new Error("Invalid phone"));
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Edit contact"}));
  await user.clear(screen.getByLabelText("Contact phone")); await user.type(screen.getByLabelText("Contact phone"),"bad");
  await user.click(screen.getByRole("button",{name:"Save changes"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid phone");
  expect(screen.getByLabelText("Contact phone")).toHaveValue("bad");
});
test("remove asks for confirmation, then shows the add form again",async()=>{
  existing(); removeEmergencyContact.mockResolvedValue({});
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Remove contact"}));
  expect(screen.getByRole("dialog")).toHaveTextContent("Mom");
  expect(removeEmergencyContact).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button",{name:"Yes, remove"}));
  expect(removeEmergencyContact).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("Your emergency contact was removed.")).toBeInTheDocument();
  expect(screen.getByLabelText("Contact name")).toHaveValue("");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("keeping the contact in the confirmation does not remove it",async()=>{
  existing(); const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Remove contact"}));
  await user.click(screen.getByRole("button",{name:"Keep contact"}));
  expect(removeEmergencyContact).not.toHaveBeenCalled();
  expect(screen.getByText("Mom")).toBeInTheDocument();
});
test("a failed remove keeps the contact and shows the error",async()=>{
  existing(); removeEmergencyContact.mockRejectedValue(new Error("Network down"));
  const user=userEvent.setup(); render(<EmergencyContact/>);
  await user.click(await screen.findByRole("button",{name:"Remove contact"}));
  await user.click(screen.getByRole("button",{name:"Yes, remove"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
  expect(screen.getByText("Mom")).toBeInTheDocument();
});
