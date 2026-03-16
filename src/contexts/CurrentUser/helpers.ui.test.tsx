import { describe, test, expect, beforeEach } from "vitest";
import { persistCurrentUser } from "./helpers.ts";

const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("persistCurrentUser", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("stores a valid UUID in localStorage", () => {
        persistCurrentUser(VALID_UUID);
        expect(localStorage.getItem("currentUser")).toBe(VALID_UUID);
    });

    test("removes from localStorage when null", () => {
        persistCurrentUser(VALID_UUID);
        persistCurrentUser(null);
        expect(localStorage.getItem("currentUser")).toBeNull();
    });

    test("throws on non-normalized UUID", () => {
        expect(() => { persistCurrentUser("not-a-uuid"); }).toThrow(
            "UUID not normalized",
        );
    });

    test("throws on UUID without dashes", () => {
        expect(() =>
            { persistCurrentUser("aaaaaaaabbbbccccddddeeeeeeeeeeee"); },
        ).toThrow("UUID not normalized");
    });
});
