import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";

import { worker } from "#mocks/worker.ts";

// Start the MSW service worker before all tests in the file, and stop it
// after. This avoids the overhead of starting/stopping the service worker for
// each individual test.
beforeAll(async () => {
    await worker.start({ onUnhandledRequest: "error", quiet: true });
});

beforeEach(() => {
    // Ensure localstorage doesn't leak between tests
    localStorage.clear();
});

afterEach(() => {
    // Remove any request handlers added in individual test cases so they
    // don't affect subsequent tests.
    worker.resetHandlers();
});

afterAll(() => {
    worker.stop();
});
