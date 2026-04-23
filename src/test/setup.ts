import { afterEach, beforeAll, beforeEach } from "vitest";

import { worker } from "#mocks/worker.ts";

// Start the MSW worker once per test file. Calling worker.start() per test adds
// measurable overhead; resetting handlers between tests keeps them isolated.
beforeAll(async () => {
    await worker.start({ onUnhandledRequest: "error", quiet: true });
});

beforeEach(() => {
    // Ensure localstorage doesn't leak between tests
    localStorage.clear();
});

afterEach(() => {
    worker.resetHandlers();
});
