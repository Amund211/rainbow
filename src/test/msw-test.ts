import { test as testBase } from "vitest";

import { worker } from "#mocks/worker.ts";

export const mswTest = testBase.extend({
    // oxlint-disable-next-line no-empty-pattern, react/rules-of-hooks
    worker: [async ({}, use) => use(worker), { auto: true }],
});
