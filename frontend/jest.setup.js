// Adds extra Jest DOM checks such as:
// expect(element).toBeInTheDocument()
require("@testing-library/jest-dom");

// findBy* and waitFor give up after 1 second by default. When the whole suite runs on a busy machine
// (or CI), a single re-render can take longer than that, and a correct test fails. Waiting up to
// 5 seconds costs nothing when things are fast: a wait ends as soon as its check passes.
const { configure } = require("@testing-library/react");
configure({ asyncUtilTimeout: 5000 });
