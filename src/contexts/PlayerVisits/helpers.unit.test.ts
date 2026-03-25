import { describe, test, expect } from "vitest";
import { visitPlayer, removePlayerVisits, orderPlayers } from "./helpers.ts";

const UUID_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_B = "11111111-2222-3333-4444-555555555555";

describe("visitPlayer", () => {
    test("adds a new player with visit count 1", () => {
        const result = visitPlayer({}, UUID_A);
        expect(result[UUID_A]).toBeDefined();
        expect(result[UUID_A]!.visitedCount).toBe(1);
        expect(result[UUID_A]!.lastVisited).toBeInstanceOf(Date);
    });

    test("increments visit count for an existing player", () => {
        const initial = {
            [UUID_A]: {
                visitedCount: 3,
                lastVisited: new Date("2025-01-01"),
            },
        };
        const result = visitPlayer(initial, UUID_A);
        expect(result[UUID_A]!.visitedCount).toBe(4);
    });

    test("does not modify other entries", () => {
        const initial = {
            [UUID_A]: {
                visitedCount: 1,
                lastVisited: new Date("2025-01-01"),
            },
        };
        const result = visitPlayer(initial, UUID_B);
        expect(result[UUID_A]!.visitedCount).toBe(1);
        expect(result[UUID_B]!.visitedCount).toBe(1);
    });

    test("throws on non-normalized UUID", () => {
        expect(() => visitPlayer({}, "not-a-uuid")).toThrow(
            "UUID not normalized",
        );
    });
});

describe("removePlayerVisits", () => {
    test("removes a player from visits", () => {
        const initial = {
            [UUID_A]: {
                visitedCount: 5,
                lastVisited: new Date("2025-01-01"),
            },
            [UUID_B]: {
                visitedCount: 2,
                lastVisited: new Date("2025-01-01"),
            },
        };
        const result = removePlayerVisits(initial, UUID_A);
        expect(result[UUID_A]).toBeUndefined();
        expect(result[UUID_B]).toBeDefined();
    });

    test("returns empty object when removing the only entry", () => {
        const initial = {
            [UUID_A]: {
                visitedCount: 1,
                lastVisited: new Date("2025-01-01"),
            },
        };
        const result = removePlayerVisits(initial, UUID_A);
        expect(Object.keys(result)).toHaveLength(0);
    });

    test("handles removing non-existent player gracefully", () => {
        const initial = {
            [UUID_A]: {
                visitedCount: 1,
                lastVisited: new Date("2025-01-01"),
            },
        };
        const result = removePlayerVisits(initial, UUID_B);
        expect(result[UUID_A]).toBeDefined();
    });

    test("throws on non-normalized UUID", () => {
        expect(() => removePlayerVisits({}, "not-a-uuid")).toThrow(
            "UUID not normalized",
        );
    });
});

describe("orderPlayers", () => {
    test("returns empty array for empty input", () => {
        expect(orderPlayers({})).toEqual([]);
    });

    test("returns single player", () => {
        const visits = {
            [UUID_A]: { visitedCount: 1, lastVisited: new Date() },
        };
        expect(orderPlayers(visits)).toEqual([UUID_A]);
    });

    test("orders by score (higher visit count first for same recency)", () => {
        const now = new Date();
        const visits = {
            [UUID_A]: { visitedCount: 1, lastVisited: now },
            [UUID_B]: { visitedCount: 10, lastVisited: now },
        };
        const result = orderPlayers(visits);
        expect(result[0]).toBe(UUID_B);
        expect(result[1]).toBe(UUID_A);
    });

    test("recent visits score higher than old visits with same count", () => {
        const visits = {
            [UUID_A]: {
                visitedCount: 2,
                lastVisited: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
            }, // 60 days ago
            [UUID_B]: { visitedCount: 2, lastVisited: new Date() }, // now
        };
        const result = orderPlayers(visits);
        expect(result[0]).toBe(UUID_B);
    });

    test("skips undefined entries", () => {
        const visits = {
            [UUID_A]: undefined,
            [UUID_B]: { visitedCount: 1, lastVisited: new Date() },
        };
        expect(orderPlayers(visits)).toEqual([UUID_B]);
    });
});
