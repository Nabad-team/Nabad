// Adds extra Jest DOM checks such as:
// expect(element).toBeInTheDocument()
require("@testing-library/jest-dom");

// findBy* and waitFor give up after 1 second by default. When the whole suite runs on a busy machine
// (or CI), a single re-render can take longer than that, and a correct test fails. Waiting up to
// 5 seconds costs nothing when things are fast: a wait ends as soon as its check passes.
const { configure } = require("@testing-library/react");
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement the native dialog top layer. Browser E2E tests cover
// actual focus containment and background inertness; this shim exposes open state.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}

// Pages load the account's daily AI usage (lib/aiUsageApi.js) when they open. By default tests get none, so that
// request never takes a response a test set up for another call. Tests about the usage line override getAiUsage.
jest.mock("./lib/aiUsageApi", () => ({
  ...jest.requireActual("./lib/aiUsageApi"),
  getAiUsage: jest.fn(() => Promise.resolve(null)),
}));
