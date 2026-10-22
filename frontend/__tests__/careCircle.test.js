// The care circle (story #76): the /care-circle page (invite, pending invitations, members, circles I'm in) and the
// /care-circle/accept page opened from the invitation email, signed in and signed out.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CareCirclePage from "../pages/care-circle";
import AcceptPage from "../pages/care-circle/accept";
import * as api from "../lib/careCircleApi";
import { signOut } from "../lib/session";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/careCircleApi", () => {
  const actual = jest.requireActual("../lib/careCircleApi");
  return {
    CARE_CIRCLE_PROMISE: actual.CARE_CIRCLE_PROMISE,
    longDate: actual.longDate,
    getCareCircle: jest.fn(),
    inviteToCareCircle: jest.fn(),
    cancelCareCircleInvite: jest.fn(),
    removeCareCircleMember: jest.fn(),
    leaveCareCircle: jest.fn(),
    lookupCareCircleInvite: jest.fn(),
    acceptCareCircleInvite: jest.fn(),
  };
});
jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }) => <>{children}</> }));
let mockProfile = { id: "self", fullName: "Rana", phone: "" };
jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: () => ({ selfProfile: mockProfile, linkedProfiles: [] }) }));
let mockStatus = "signedIn";
jest.mock("../components/SessionTimeout", () => ({ useSessionStatus: () => mockStatus, useSignedIn: () => mockStatus === "signedIn" }));
let mockQuery = {};
jest.mock("next/router", () => ({ useRouter: () => ({ isReady: true, query: mockQuery, push: jest.fn(), replace: jest.fn() }) }));
jest.mock("../lib/session", () => ({ ...jest.requireActual("../lib/session"), signOut: jest.fn() }));

const KARIM = { id: "m1", name: "Karim", email: "karim@example.test", since: "2026-10-01T10:00:00.000Z" };
const PENDING = { id: "p1", email: "layla@example.test", sentAt: "2026-10-20T10:00:00.000Z", expiresAt: "2026-10-27T10:00:00.000Z" };
const NOUR = { id: "c1", name: "Nour", since: "2026-09-01T10:00:00.000Z" };
const circleData = (fields = {}) => ({ members: [], pending: [], circles: [], maxMembers: 5, ...fields });

describe("Care circle page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile = { id: "self", fullName: "Rana", phone: "" };
    api.getCareCircle.mockResolvedValue(circleData());
  });

  test("explains what members see, with empty states", async () => {
    render(<CareCirclePage />);
    expect(CareCirclePage.requireSignIn).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Care circle" })).toBeInTheDocument();
    expect(screen.getByText("People in your care circle are told when a symptom check needs attention. They never see your symptoms.")).toBeInTheDocument();
    expect(document.querySelector("title")).toHaveTextContent("Care circle · Nabad");
    expect(await screen.findByText("No one is in your care circle yet.")).toBeInTheDocument();
    expect(screen.getByText("You're not in anyone's care circle.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Waiting to accept" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile");
  });

  test("says the alert includes the saved phone number", async () => {
    mockProfile = { ...mockProfile, phone: "+96170123456" };
    render(<CareCirclePage />);
    expect(await screen.findByText(/includes your phone number \(\+96170123456\)/)).toBeInTheDocument();
  });

  test("invites by email: checks the address, sends, and shows the pending invitation", async () => {
    const user = userEvent.setup({ delay: null });
    api.inviteToCareCircle.mockResolvedValue({ message: "Invitation sent to layla@example.test. It expires in 7 days." });
    render(<CareCirclePage />);
    const field = await screen.findByLabelText("Their email address");
    await user.type(field, "not an email");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(field).toHaveAccessibleDescription(/Enter a valid email address/);
    expect(api.inviteToCareCircle).not.toHaveBeenCalled();

    api.getCareCircle.mockResolvedValue(circleData({ pending: [PENDING] }));
    await user.clear(field);
    await user.type(field, " layla@example.test ");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(api.inviteToCareCircle).toHaveBeenCalledWith("layla@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation sent to layla@example.test. It expires in 7 days.");
    const pending = await screen.findByRole("heading", { name: "Waiting to accept" });
    const section = pending.closest("section");
    expect(within(section).getByText("layla@example.test")).toBeInTheDocument();
    expect(within(section).getByText(`Invitation expires on ${api.longDate(PENDING.expiresAt)}`)).toBeInTheDocument();
    expect(field).toHaveValue("");
  });

  test("shows the server's message when an invitation fails", async () => {
    const user = userEvent.setup({ delay: null });
    api.inviteToCareCircle.mockRejectedValue(new Error("karim@example.test is already in your care circle."));
    render(<CareCirclePage />);
    await user.type(await screen.findByLabelText("Their email address"), "karim@example.test");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("karim@example.test is already in your care circle.");
  });

  test("a full circle can't invite more", async () => {
    api.getCareCircle.mockResolvedValue(circleData({ members: [KARIM, { ...KARIM, id: "m2" }, { ...KARIM, id: "m3" }], pending: [PENDING, { ...PENDING, id: "p2" }] }));
    render(<CareCirclePage />);
    expect(await screen.findByText(/Your care circle is full/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeDisabled();
  });

  test("cancels an invitation, and removes a member after confirming", async () => {
    const user = userEvent.setup({ delay: null });
    api.getCareCircle.mockResolvedValue(circleData({ members: [KARIM], pending: [PENDING] }));
    api.cancelCareCircleInvite.mockResolvedValue({});
    api.removeCareCircleMember.mockResolvedValue({});
    render(<CareCirclePage />);
    await user.click(await screen.findByRole("button", { name: "Cancel the invitation to layla@example.test" }));
    expect(api.cancelCareCircleInvite).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation to layla@example.test cancelled.");

    const members = screen.getByRole("heading", { name: "People in your care circle" }).closest("section");
    expect(within(members).getByText("Karim")).toBeInTheDocument();
    expect(within(members).getByText("karim@example.test")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Karim" }));
    const dialog = screen.getByRole("dialog", { name: "Remove Karim?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.removeCareCircleMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove Karim" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
    expect(api.removeCareCircleMember).toHaveBeenCalledWith("m1");
    expect(await screen.findByRole("status")).toHaveTextContent("Karim was removed from your care circle.");
  });

  test("lists the circles I'm in and leaves one after confirming", async () => {
    const user = userEvent.setup({ delay: null });
    api.getCareCircle.mockResolvedValue(circleData({ circles: [NOUR] }));
    api.leaveCareCircle.mockRejectedValueOnce(new Error("Request failed.")).mockResolvedValue({});
    render(<CareCirclePage />);
    await user.click(await screen.findByRole("button", { name: "Leave Nour's care circle" }));
    expect(screen.getByRole("dialog", { name: "Leave Nour's care circle?" })).toHaveTextContent("You will no longer be told when Nour's symptom checks need attention.");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't leave that care circle. Please try again.");
    await user.click(screen.getByRole("button", { name: "Leave Nour's care circle" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave" }));
    expect(await screen.findByRole("status")).toHaveTextContent("You left Nour's care circle.");
    expect(api.leaveCareCircle).toHaveBeenLastCalledWith("c1");
  });

  test("offers to try again when the circle can't load", async () => {
    const user = userEvent.setup({ delay: null });
    api.getCareCircle.mockRejectedValueOnce(new Error("offline"));
    render(<CareCirclePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your care circle.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No one is in your care circle yet.")).toBeInTheDocument();
  });
});

describe("Accept a care circle invitation", () => {
  const TOKEN = "a".repeat(64);
  const INVITE = { inviterName: "Rana", email: "karim@example.test", expiresAt: "2026-10-27T10:00:00.000Z" };
  const here = `/care-circle/accept?token=${TOKEN}`;
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = { token: TOKEN };
    mockStatus = "signedIn";
    api.lookupCareCircleInvite.mockResolvedValue(INVITE);
  });

  test("signed in: says who invited and what members see, then joins", async () => {
    const user = userEvent.setup({ delay: null });
    api.acceptCareCircleInvite.mockResolvedValue({ message: "You're now in Rana's care circle.", circle: { id: "c1", name: "Rana" } });
    render(<AcceptPage />);
    expect(document.querySelector("title")).toHaveTextContent("Join a care circle · Nabad");
    expect(await screen.findByText(/invited you to their care circle/)).toHaveTextContent("Rana invited you to their care circle.");
    expect(screen.getByText(/you never see their symptoms or health details/)).toBeInTheDocument();
    expect(screen.getByText(`This invitation was sent to karim@example.test and expires on ${api.longDate(INVITE.expiresAt)}.`)).toBeInTheDocument();
    expect(api.lookupCareCircleInvite).toHaveBeenCalledWith(TOKEN);
    await user.click(screen.getByRole("button", { name: "Join Rana's care circle" }));
    expect(api.acceptCareCircleInvite).toHaveBeenCalledWith(TOKEN);
    expect(await screen.findByRole("status")).toHaveTextContent("You're now in Rana's care circle.");
    expect(screen.getByRole("link", { name: "Go to your care circle" })).toHaveAttribute("href", "/care-circle");
  });

  test("signed out: sends the visitor to log in or sign up with the invited email, and back here", async () => {
    mockStatus = "signedOut";
    render(<AcceptPage />);
    expect(await screen.findByText(/To join, sign in with/)).toHaveTextContent("karim@example.test");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(here)}`);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", `/signup?email=${encodeURIComponent("karim@example.test")}&next=${encodeURIComponent(here)}`);
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
    expect(api.acceptCareCircleInvite).not.toHaveBeenCalled();
  });

  test("signed in with another email: explains and offers to sign in with the right one", async () => {
    const user = userEvent.setup({ delay: null });
    api.acceptCareCircleInvite.mockRejectedValue(Object.assign(new Error("This invitation was sent to karim@example.test. Sign in with that email address to accept it."), { status: 403 }));
    render(<AcceptPage />);
    await user.click(await screen.findByRole("button", { name: "Join Rana's care circle" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign in with that email address to accept it.");
    await user.click(screen.getByRole("button", { name: "Sign in as karim@example.test" }));
    expect(signOut).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(here)}`);
  });

  test("an expired, used or incomplete link says so", async () => {
    api.lookupCareCircleInvite.mockRejectedValue(new Error("This invitation has expired. Ask the person who invited you to send a new one."));
    const { unmount } = render(<AcceptPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation has expired.");
    unmount();
    mockQuery = {};
    render(<AcceptPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation link is incomplete.");
  });
});
