import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmergencyContact from "../components/EmergencyContact";
import { getEmergencyContact, addEmergencyContact } from "../lib/api";
jest.mock("../lib/api",()=>({getEmergencyContact:jest.fn(),addEmergencyContact:jest.fn()}));
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
