// Automated tests for safeNextPath (lib/session.js): after logging in, users may only be
// sent to a page on our own site, never to an outside URL.
import { safeNextPath } from "../lib/session";

describe("safeNextPath", () => {
  test.each([
    ["/dashboard", "/dashboard"],
    ["/profile", "/profile"],
    ["/profile?tab=contacts#top", "/profile?tab=contacts#top"],
  ])("allows the page on our site %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  test.each([
    ["an outside URL", "https://evil.example/login"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a hidden tab", "/\t/evil.example"],
    ["a hidden newline", "/\n/evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a path without the leading slash", "evil.example"],
    ["an empty value", ""],
    ["a missing value", undefined],
    ["a repeated query parameter", ["/profile", "https://evil.example"]],
  ])("falls back to the dashboard for %s", (_, next) => {
    expect(safeNextPath(next)).toBe("/dashboard");
  });
});
