// Automated tests for the profile API client (lib/profileApi.js).
// fetch is replaced by a fake, so these tests check exactly what is sent to the backend
// and what the pages get back.

import {
  getMyProfile,
  updateMyProfile,
  listLinkedProfiles,
  addLinkedProfile,
  removeLinkedProfile,
  deleteAccount,
  updateProfilePicture,
  removeProfilePicture,
  RELATIONSHIPS,
  MAX_LINKED_PROFILES,
} from "../lib/profileApi";

const SELF = { id: "self", fullName: "Layla", email: "layla@example.test", phone: "", dateOfBirth: "", relationship: "self", isSelf: true, profilePicture: "", authProvider: "password" };
const CHILD = { id: "65f000000000000000000001", fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child", isSelf: false, profilePicture: "" };

// Makes the next fetch answer with this status and JSON body (no body for 204).
function answer(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? () => Promise.reject(new Error("no body")) : () => Promise.resolve(body),
  });
}

// The URL, method and parsed body of the last request.
function lastRequest() {
  const [url, options = {}] = global.fetch.mock.calls.at(-1);
  return { url, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : undefined, options };
}

describe("profileApi", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("keeps the constants the pages use", () => {
    expect(RELATIONSHIPS).toEqual(["child", "parent", "spouse", "other"]);
    expect(MAX_LINKED_PROFILES).toBe(10);
  });

  test("getMyProfile loads the signed-in user's profile with the login cookie", async () => {
    answer(200, { profile: SELF });

    expect(await getMyProfile()).toEqual(SELF);
    const { url, method, options } = lastRequest();
    expect(url).toBe("/api/profile/me");
    expect(method).toBe("GET");
    expect(options.credentials).toBe("include");
  });

  test("updateMyProfile sends only name, phone and date of birth", async () => {
    answer(200, { profile: { ...SELF, fullName: "Layla H" } });

    const saved = await updateMyProfile({ ...SELF, fullName: "Layla H", phone: "71123456", dateOfBirth: "1990-01-02" });

    expect(saved.fullName).toBe("Layla H");
    expect(lastRequest()).toMatchObject({ url: "/api/profile/me", method: "PATCH", body: { fullName: "Layla H", phone: "71123456", dateOfBirth: "1990-01-02" } });
    // Email, id and other fields are never sent.
    expect(Object.keys(lastRequest().body)).toEqual(["fullName", "phone", "dateOfBirth"]);
  });

  test("listLinkedProfiles returns the dependents", async () => {
    answer(200, { profiles: [CHILD] });

    expect(await listLinkedProfiles()).toEqual([CHILD]);
    expect(lastRequest()).toMatchObject({ url: "/api/profile/linked", method: "GET" });
  });

  test("addLinkedProfile sends the dependent's details and returns the saved profile", async () => {
    answer(201, { profile: CHILD });

    expect(await addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child", owner: "someone-else" })).toEqual(CHILD);
    expect(lastRequest()).toMatchObject({ url: "/api/profile/linked", method: "POST" });
    expect(lastRequest().body).toEqual({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" });
  });

  test("addLinkedProfile passes on the backend's error message", async () => {
    answer(400, { error: "You can link up to 10 dependents." });

    await expect(addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" })).rejects.toThrow("You can link up to 10 dependents.");
  });

  test("removeLinkedProfile deletes by id", async () => {
    answer(204);

    await expect(removeLinkedProfile(CHILD.id)).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ url: `/api/profile/linked/${CHILD.id}`, method: "DELETE" });
  });

  test("removeLinkedProfile passes on 'Profile not found.' for someone else's profile", async () => {
    answer(404, { error: "Profile not found." });

    await expect(removeLinkedProfile("65f0000000000000000000ff")).rejects.toThrow("Profile not found.");
  });

  test("ids are escaped in the URL", async () => {
    answer(404, { error: "Profile not found." });

    await expect(removeLinkedProfile("../me")).rejects.toThrow();
    expect(lastRequest().url).toBe("/api/profile/linked/..%2Fme");
  });

  test("deleteAccount confirms with the password for password accounts", async () => {
    answer(204);

    await deleteAccount("my password");

    expect(lastRequest()).toMatchObject({ url: "/api/profile/me", method: "DELETE", body: { confirm: "DELETE", password: "my password" } });
    expect(lastRequest().body.email).toBeUndefined();
  });

  test("deleteAccount confirms with the email for Google-only accounts", async () => {
    answer(204);

    await deleteAccount("layla@example.test", { google: true });

    expect(lastRequest().body).toEqual({ confirm: "DELETE", email: "layla@example.test" });
  });

  test("deleteAccount passes on a wrong password", async () => {
    answer(400, { error: "Password is incorrect." });

    await expect(deleteAccount("wrong")).rejects.toThrow("Password is incorrect.");
  });

  test("pictures go to /me/picture for the account owner", async () => {
    answer(200, { profile: { ...SELF, profilePicture: "data:image/png;base64,AAAA" } });

    const saved = await updateProfilePicture("self", "data:image/png;base64,AAAA");

    expect(saved.profilePicture).toBe("data:image/png;base64,AAAA");
    expect(lastRequest()).toMatchObject({ url: "/api/profile/me/picture", method: "PUT", body: { profilePicture: "data:image/png;base64,AAAA" } });

    answer(200, { profile: SELF });
    await removeProfilePicture("self");
    expect(lastRequest()).toMatchObject({ url: "/api/profile/me/picture", method: "DELETE" });
  });

  test("pictures go to /linked/:id/picture for a dependent", async () => {
    answer(200, { profile: CHILD });
    await updateProfilePicture(CHILD.id, "data:image/jpeg;base64,AAAA");
    expect(lastRequest()).toMatchObject({ url: `/api/profile/linked/${CHILD.id}/picture`, method: "PUT" });

    answer(200, { profile: CHILD });
    await removeProfilePicture(CHILD.id);
    expect(lastRequest()).toMatchObject({ url: `/api/profile/linked/${CHILD.id}/picture`, method: "DELETE" });
  });

  test("a signed-out request fails with status 401", async () => {
    answer(401, { error: "Not authenticated." });

    await expect(getMyProfile()).rejects.toMatchObject({ message: "Not authenticated.", status: 401 });
  });
});
