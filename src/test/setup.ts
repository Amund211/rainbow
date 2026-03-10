import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "#mocks/server.ts";

// Suppress Recharts ResponsiveContainer dimension warnings in jsdom.
// jsdom has no layout engine, so getBoundingClientRect() returns zeros and
// ResponsiveContainer calculates -1 dimensions, producing ~100 warnings per run.
// See: https://github.com/recharts/recharts/issues/2268
// See: https://github.com/jsdom/jsdom/issues/653
const originalWarn = console.warn;
console.warn = (...args: Parameters<typeof console.warn>) => {
    if (
        typeof args[0] === "string" &&
        args[0].includes("of chart should be greater than 0")
    ) {
        return;
    }
    originalWarn(...args);
};

configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement window.matchMedia
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

beforeAll(() => {
    server.listen({ onUnhandledRequest: "warn" });
});
afterEach(() => {
    server.resetHandlers();
    cleanup();
});
afterAll(() => {
    server.close();
});
