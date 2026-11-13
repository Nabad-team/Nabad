import { render, screen, waitFor } from "@testing-library/react";
import ProviderMap from "../components/ProviderMap";
import { clusterMapProviders, groupMapProviders } from "../lib/providerMap";
const mockMap = { setView: jest.fn().mockReturnThis(), fitBounds: jest.fn(), remove: jest.fn(), getZoom: () => 14, on: jest.fn() };
const mockLayer = { addTo: jest.fn().mockReturnThis(), clearLayers: jest.fn() };
const mockMarker = { bindPopup: jest.fn().mockReturnThis(), addTo: jest.fn().mockReturnThis() };
const mockTiles = { on: jest.fn().mockReturnThis(), addTo: jest.fn() };
jest.mock("leaflet", () => ({ map: jest.fn(() => mockMap), layerGroup: jest.fn(() => mockLayer), tileLayer: jest.fn(() => mockTiles), marker: jest.fn(() => mockMarker), divIcon: jest.fn() }));
const providers = [{ id: "one", name: "Clinic <img src=x>", latitude: 33.9, longitude: 35.5 }, { id: "two", name: "Hospital", latitude: 33.9, longitude: 35.5 }];
beforeEach(() => jest.clearAllMocks());
test("shared campus markers include every provider, invalid coordinates are excluded", () => {
  expect(groupMapProviders([...providers, { latitude: 95, longitude: 1 }])).toEqual([providers]);
});
test("nearby facilities cluster when zoomed out and separate again when zoomed in", () => {
  const nearby = { ...providers[0], id: "nearby", latitude: 33.91 };
  const distant = { ...providers[0], id: "distant", latitude: 34.8 };
  const groups = groupMapProviders([...providers, nearby, distant]);
  const project = ([latitude, longitude]) => ({ x: longitude * 100, y: (latitude - 33.8) * 100 });
  expect(clusterMapProviders(groups, project, 8)).toEqual([[...providers, nearby], [distant]]);
  expect(clusterMapProviders(groups, project, 14)).toEqual([providers, [nearby], [distant]]);
});
test("popups render text safely, fit the results, and remove the map on unmount", async () => {
  const { unmount } = render(<ProviderMap providers={providers} />);
  await waitFor(() => expect(mockMarker.bindPopup).toHaveBeenCalledTimes(1));
  const popup = mockMarker.bindPopup.mock.calls[0][0];
  expect(popup.querySelectorAll("a")).toHaveLength(2);
  expect(popup.querySelector("img")).toBeNull();
  expect(popup.textContent).toContain("Clinic <img src=x>");
  expect(mockMap.fitBounds).toHaveBeenCalled();
  unmount(); expect(mockMap.remove).toHaveBeenCalledTimes(1);
});
test("tile failure gives a usable list fallback message", async () => {
  mockTiles.on.mockImplementationOnce((event, callback) => { callback(); return mockTiles; });
  render(<ProviderMap providers={providers} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("list below");
});
