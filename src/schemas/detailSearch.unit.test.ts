import { test, expect, describe } from "vitest";

import { detailSearchSchema } from "./detailSearch.ts";

describe("detailSearchSchema validation", () => {
    test("valid date string is coerced to a Date", () => {
        const result = detailSearchSchema.parse({
            date: "2025-11-03T22:59:59.999Z",
        });
        expect(result.date).toStrictEqual(new Date("2025-11-03T22:59:59.999Z"));
    });

    test("date coercion understands simple date strings", () => {
        // NOTE: These should be UTC dates with timezone in production
        const result = detailSearchSchema.parse({ date: "2024-01-15" });

        expect(result.date.getFullYear()).toBe(2024);
        expect(result.date.getMonth()).toBe(0);
        expect(result.date.getDate()).toBe(15);
    });

    test("missing date -> falls back to a valid Date instead of throwing", () => {
        const result = detailSearchSchema.parse({});
        expect(result.date).toBeInstanceOf(Date);
        expect(Number.isNaN(result.date.getTime())).toBe(false);
    });

    test("malformed date -> falls back to a valid Date instead of throwing", () => {
        const result = detailSearchSchema.parse({ date: "not-a-date" });
        expect(result.date).toBeInstanceOf(Date);
        expect(Number.isNaN(result.date.getTime())).toBe(false);
    });
});
