// Time limits for tests that are slow for a good reason. Jest's default is 5 seconds per test.
//
// Page-flow tests render a whole page, type into forms, save, and wait for the page to update.
// They take well under a second on an idle machine, but 2-3 seconds while the whole suite (or CI)
// keeps every CPU busy. 15 seconds leaves plenty of room for that, while a test that really hangs
// still fails in reasonable time. Use it with jest.setTimeout(PAGE_FLOW_TIMEOUT) at the top of a
// page-flow test file.
export const PAGE_FLOW_TIMEOUT = 15000;

// For tests that do a lot of CPU work on purpose (for example checking every common password).
export const HEAVY_COMPUTE_TIMEOUT = 30000;
