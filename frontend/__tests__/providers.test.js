import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProvidersPage from "../pages/providers";
import { getProviders, getProviderFavorites, setProviderFavorite } from "../lib/providerApi";
let mockSignedIn = true;
let mockRouter = { isReady: true, query: {}, asPath: "/providers", push: jest.fn() };
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("../components/SessionTimeout", () => ({ useSignedIn: () => mockSignedIn }));
jest.mock("../lib/providerApi", () => ({ getProviders: jest.fn(), getProviderFavorites: jest.fn(), setProviderFavorite: jest.fn() }));
jest.mock("../components/ProfileHeader", () => () => <header>Profile</header>);
const provider = { id: "clinic", name: "Test Clinic", type: "clinic", city: "Beirut", address: "Clinic Street",
  latitude: 33.9, longitude: 35.5, services: ["mri"], specialties: ["pediatrics"], phone: "+9611000000", sources: ["https://example.org"], verifiedAt: "2026-10-15T00:00:00Z" };
const result = { providers: [provider], total: 1, specialties: ["pediatrics"], cities: ["Beirut"] };
beforeEach(() => { jest.resetAllMocks(); mockSignedIn = true; mockRouter = { isReady: true, query: {}, asPath: "/providers", push: jest.fn() }; getProviders.mockResolvedValue(result); getProviderFavorites.mockResolvedValue([]); setProviderFavorite.mockResolvedValue({}); });

test("emergency routing asks for location, applies it immediately and identifies the closest capability match", async () => {
  mockRouter = { ...mockRouter, query: { emergencyNeeds: "cardiac" }, asPath: "/providers?emergencyNeeds=cardiac" };
  const locate = jest.fn(success => success({ coords: { latitude: 33.9, longitude: 35.5 } }));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: locate } });
  getProviders.mockResolvedValue({ ...result, page: 1, providers: [{ ...provider, type: "hospital", distanceKm: 2.1 }] });
  const user = userEvent.setup(); render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  expect(locate).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: /Call 140/ })).toHaveAttribute("href", "tel:140");
  expect(screen.getByText(/Only hospital ERs with all published requirements/)).toHaveTextContent("cardiology and catheterization lab");
  expect(screen.queryByText(/Closest listed match/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Find nearest matching hospital" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ emergencyNeeds: "cardiac", emergency24h: true, lat: 33.9, lng: 35.5, page: 1 }), expect.any(AbortSignal)));
  expect(await screen.findByText(/Closest listed match by straight-line distance/)).toBeInTheDocument();
  expect(mockRouter.push.mock.calls.at(-1)[0]).not.toMatch(/33\.9|35\.5|lat|lng/);
});

test("emergency location denial stays unranked and no match keeps emergency help visible", async () => {
  mockRouter = { ...mockRouter, query: { emergencyNeeds: "burns" }, asPath: "/providers?emergencyNeeds=burns" };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success, failure) => failure({ code: 1 }) } });
  getProviders.mockResolvedValue({ ...result, providers: [], total: 0 });
  const user = userEvent.setup(); render(<ProvidersPage />);
  expect(await screen.findByText(/No hospital with all required published capabilities/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Find nearest matching hospital" }));
  expect(screen.getByRole("alert")).toHaveTextContent("choose a city");
  expect(screen.getByText(/Without it, results are alphabetical/)).toBeInTheDocument();
  expect(screen.queryByText(/Closest listed match/)).not.toBeInTheDocument();
  expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ emergencyNeeds: "burns" }), expect.any(AbortSignal));
});

test("a late location callback cannot restore a previous condition after navigation", async () => {
  let success;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: callback => { success = callback; } } });
  mockRouter = { ...mockRouter, query: { emergencyNeeds: "cardiac" }, asPath: "/providers?emergencyNeeds=cardiac" };
  const user = userEvent.setup(); const view = render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  await user.click(screen.getByRole("button", { name: "Find nearest matching hospital" }));
  mockRouter = { ...mockRouter, query: { emergencyNeeds: "stroke" }, asPath: "/providers?emergencyNeeds=stroke" };
  view.rerender(<ProvidersPage />);
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ emergencyNeeds: "stroke" }), expect.any(AbortSignal)));
  success({ coords: { latitude: 33.9, longitude: 35.5 } });
  expect(mockRouter.push).not.toHaveBeenCalled();
});
test("lists providers and submits a specialty search", async () => {
  const user = userEvent.setup(); render(<ProvidersPage />);
  expect(await screen.findByRole("heading", { name: "Test Clinic" })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Specialty"), "pediatrics");
  await user.type(screen.getByLabelText("Search by hospital or clinic name"), "Test");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Test", specialty: "pediatrics" }), expect.any(AbortSignal)));
  expect(ProvidersPage.requireSignIn).not.toBe(true);
});
test("location is opt-in, permission denial leaves city search usable", async () => {
  const locate = jest.fn((success, failure) => failure({ code: 1 }));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: locate } });
  const user = userEvent.setup(); render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  expect(locate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Use my location" }));
  expect(screen.getByRole("alert")).toHaveTextContent("choose a city");
  await user.selectOptions(screen.getByLabelText("City"), "beirut");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ city: "beirut" }), expect.any(AbortSignal)));
});
test("location and radius are submitted and can be cleared", async () => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: success => success({ coords: { latitude: 33.9, longitude: 35.5 } }) } });
  const user = userEvent.setup(); render(<ProvidersPage />); await screen.findByText("Test Clinic");
  await user.click(screen.getByRole("button", { name: "Use my location" }));
  await user.selectOptions(screen.getByLabelText("Maximum distance"), "10");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 33.9, lng: 35.5, radiusKm: "10" }), expect.any(AbortSignal)));
  await user.click(screen.getByRole("button", { name: "Clear my location" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ lat: undefined, lng: undefined, radiusKm: "" }), expect.any(AbortSignal)));
});
test("failed requests can be retried and empty results are explained", async () => {
  getProviders.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ...result, providers: [], total: 0 });
  const user = userEvent.setup(); render(<ProvidersPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load providers");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No providers match these filters.")).toBeInTheDocument();
});
test("save and remove favorites persist through the API and update the controls", async () => {
  const user = userEvent.setup(); render(<ProvidersPage />);
  await user.click(await screen.findByRole("button", { name: "Save Test Clinic" }));
  expect(setProviderFavorite).toHaveBeenCalledWith("clinic", true);
  expect(await screen.findByText("Test Clinic saved.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove Test Clinic from saved providers" }));
  expect(setProviderFavorite).toHaveBeenLastCalledWith("clinic", false);
  expect(await screen.findByText("Test Clinic removed from saved providers.")).toBeInTheDocument();
});
test("failed favorite writes never pretend a provider was saved", async () => {
  setProviderFavorite.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup(); render(<ProvidersPage />);
  await user.click(await screen.findByRole("button", { name: "Save Test Clinic" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("couldn't update");
  expect(screen.getByRole("button", { name: "Save Test Clinic" })).toHaveAttribute("aria-pressed", "false");
});
test("favorite filter uses the same server-side filtering as other searches", async () => {
  const user = userEvent.setup(); render(<ProvidersPage />); await screen.findByText("Test Clinic");
  await user.click(screen.getByLabelText("My saved providers"));
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ favorites: true }), expect.any(AbortSignal)));
});

test("public visitors can browse and get a sign-in link without a favorites request", async () => {
  mockSignedIn = false;
  render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  expect(getProviderFavorites).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Sign in to save" })).toHaveAttribute("href", "/login");
  expect(screen.queryByLabelText("My saved providers")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Directions in Google Maps" })).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=33.9%2C35.5");
});
test("URL filters hydrate on load and browser navigation restores them", async () => {
  mockRouter = { ...mockRouter, query: { specialty: "pediatrics", emergency24h: "true", service: "mri" }, asPath: "/providers?specialty=pediatrics&emergency24h=true&service=mri" };
  const view = render(<ProvidersPage />);
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ specialty: "pediatrics", emergency24h: true, service: "mri" }), expect.any(AbortSignal)));
  mockRouter = { ...mockRouter, query: { city: "beirut" }, asPath: "/providers?city=beirut" };
  view.rerender(<ProvidersPage />);
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ city: "beirut", specialty: "", emergency24h: false }), expect.any(AbortSignal)));
});
test("submitted filters update the URL without exposing coordinates", async () => {
  const user = userEvent.setup(); render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  await user.selectOptions(screen.getByLabelText("Specialty"), "pediatrics");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/providers?specialty=pediatrics", undefined, { shallow: true, scroll: false });
});

test("district search is shareable and unlocated facilities do not offer fake directions", async () => {
  getProviders.mockResolvedValue({ ...result, districts: ["Saida"], providers: [{ ...provider, district: "Saida", city: "", address: "", latitude: null, longitude: null }] });
  const user = userEvent.setup(); render(<ProvidersPage />);
  await screen.findByText("Test Clinic");
  expect(screen.queryByRole("link", { name: "Directions in Google Maps" })).not.toBeInTheDocument();
  expect(screen.getByText(/Map location not yet verified/)).toBeInTheDocument();
  expect(screen.getByText("Street address not yet verified")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("District"), "saida");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/providers?district=saida", undefined, { shallow: true, scroll: false });
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ district: "saida", city: "" }), expect.any(AbortSignal)));
});

test("insurance filters are submitted and retained in shareable URLs", async () => {
  getProviders.mockResolvedValue({ ...result, insurances: ["nssf", "coop"] });
  const user = userEvent.setup(); render(<ProvidersPage />); await screen.findByText("Test Clinic");
  await user.selectOptions(screen.getByLabelText("Insurance and third-party payers"), "nssf");
  await user.click(screen.getByRole("button", { name: "Search providers" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/providers?insurance=nssf", undefined, { shallow: true, scroll: false });
  await waitFor(() => expect(getProviders).toHaveBeenLastCalledWith(expect.objectContaining({ insurance: "nssf" }), expect.any(AbortSignal)));
  expect(screen.getByRole("link", { name: "Test Clinic" })).toHaveAttribute("href", "/providers/clinic");
});
