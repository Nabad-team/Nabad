import { addVital, deleteVital, listVitals } from "../lib/vitalsApi";
import { request } from "../lib/api";

jest.mock("../lib/api", () => ({ request: jest.fn() }));

beforeEach(() => request.mockReset());

test("vitals requests always include the active profile", async () => {
  request.mockResolvedValueOnce({ readings: [] });
  await listVitals("profile 1", "7");
  expect(request).toHaveBeenCalledWith("/vitals?profileId=profile%201&range=7");

  request.mockResolvedValueOnce({ reading: { id: "one" } });
  await addVital("self", { heartRate: 72 });
  expect(request).toHaveBeenLastCalledWith("/vitals?profileId=self", expect.objectContaining({ method: "POST" }));

  request.mockResolvedValueOnce({});
  await deleteVital("self", "one");
  expect(request).toHaveBeenLastCalledWith("/vitals/one?profileId=self", { method: "DELETE" });
});
