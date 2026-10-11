// Jest configuration for the Nabad frontend.
// This tells Jest how to run tests in our Next.js project.

const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  // Half the CPU cores, not all but one: with every core busy (for example while the backend tests run
  // too), page-flow tests were starved for seconds at a time. CI runs the suite serially (--runInBand).
  maxWorkers: "50%",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
  },
};

module.exports = createJestConfig(customJestConfig);