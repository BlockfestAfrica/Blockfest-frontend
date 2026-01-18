/**
 * Vitest setup file
 * Runs before all tests
 */

import { afterEach } from "vitest";

// Mock environment variables
process.env.NODE_ENV = "test";

// Clean up after each test
afterEach(() => {
  // Reset any mocks
});
