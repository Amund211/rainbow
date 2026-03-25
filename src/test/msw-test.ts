import { test as testBase } from "vitest";

import { worker } from "#mocks/worker.ts";

// Extend test to expose the MSW worker for tests that need to add custom
// request handlers. The worker lifecycle (start/stop/reset) is managed by the
// setup file, so this fixture only provides access to the worker object.
export const mswTest = testBase.extend({
    worker: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            await use(worker);
        },
        { auto: false },
    ],
});
