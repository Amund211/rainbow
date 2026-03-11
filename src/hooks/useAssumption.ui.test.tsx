import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAssume } from "./useAssumption.ts";

vi.mock("@sentry/react", () => ({
    captureMessage: vi.fn(),
}));

import { captureMessage } from "@sentry/react";

describe("useAssume", () => {
    const originalAlert = window.alert;

    beforeEach(() => {
        vi.clearAllMocks();
        window.alert = vi.fn();
    });

    afterEach(() => {
        window.alert = originalAlert;
    });

    it("does nothing when assumption holds (true)", () => {
        const { result } = renderHook(() => useAssume());
        act(() => {
            result.current(true, "should not fire");
        });
        expect(captureMessage).not.toHaveBeenCalled();
    });

    it("reports to Sentry when assumption fails (false)", () => {
        const { result } = renderHook(() => useAssume());
        act(() => {
            result.current(false, "something went wrong");
        });
        expect(captureMessage).toHaveBeenCalledWith(
            "Assumption failed: something went wrong",
            expect.objectContaining({ level: "error" }),
        );
    });

    it("includes meta from getMeta callback", () => {
        const { result } = renderHook(() => useAssume());
        act(() => {
            result.current(false, "test with meta", () => ({
                key: "value",
            }));
        });
        expect(captureMessage).toHaveBeenCalledWith(
            "Assumption failed: test with meta",
            expect.objectContaining({
                extra: { key: "value" },
            }),
        );
    });

    it("does not report the same assumption failure twice", () => {
        const { result } = renderHook(() => useAssume());
        act(() => {
            result.current(false, "duplicate message");
        });
        act(() => {
            result.current(false, "duplicate message");
        });
        expect(captureMessage).toHaveBeenCalledTimes(1);
    });

    it("reports different assumption failures separately", () => {
        const { result } = renderHook(() => useAssume());
        act(() => {
            result.current(false, "first failure");
        });
        act(() => {
            result.current(false, "second failure");
        });
        expect(captureMessage).toHaveBeenCalledTimes(2);
    });

    it("returns a stable function reference", () => {
        const { result, rerender } = renderHook(() => useAssume());
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
