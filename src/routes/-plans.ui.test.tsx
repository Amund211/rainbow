import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { prefetchPlan } from "#queries/plan.ts";
import { makeHistoryExploreQueryPlan } from "#routes/history.explore.tsx";
import { makeSessionQueryPlan } from "#routes/session/$uuid.tsx";
import { makeSessionDetailQueryPlan } from "#routes/session/$uuid_.detail.tsx";
import { makeWrappedQueryPlan } from "#routes/wrapped/$uuid.tsx";

// These live in the browser project rather than the unit one because the route
// modules they import reach for browser globals while loading.

const UUID = "01234567-89ab-cdef-0123-456789abcdef";

const start = new Date("2026-03-01T00:00:00.000Z");
const end = new Date("2026-03-31T23:59:59.999Z");

/**
 * Stand-in for the query client, so a test can see exactly which queries a
 * loader would kick off.
 */
const spyClient = () => {
    const prefetchQuery = vi.fn<QueryClient["prefetchQuery"]>();
    return {
        client: { prefetchQuery } as unknown as QueryClient,
        prefetchQuery,
    };
};

describe("route query plans", () => {
    test("the session plan covers every query the page reads", () => {
        const plan = makeSessionQueryPlan(UUID, {
            timeIntervalDefinition: { type: "until", date: end },
            trackingStart: start,
        });

        expect(Object.keys(plan).toSorted()).toStrictEqual([
            "dayChart",
            "dayStat",
            "monthChart",
            "monthStat",
            "sessions",
            "tracking",
            "username",
            "weekChart",
            "weekStat",
        ]);

        // Stat cards read the interval endpoints, sparklines the curve between.
        expect(plan.dayStat.limit).toBe(2);
        expect(plan.dayChart.limit).toBe(100);
        // Both describe the same window.
        expect(plan.dayStat.start).toStrictEqual(plan.dayChart.start);
        expect(plan.dayStat.end).toStrictEqual(plan.dayChart.end);

        // The session table reads sessions over the month, alongside the month
        // history it is merged with. This entry was missing from the loader
        // before the plan existed, so the table always waterfalled.
        expect(plan.sessions.start).toStrictEqual(plan.monthStat.start);
        expect(plan.sessions.end).toStrictEqual(plan.monthStat.end);

        expect(plan.tracking.start).toStrictEqual(start);
        expect(plan.tracking.end).toStrictEqual(plan.dayStat.end);
    });

    test("the session detail plan covers every query the page reads", () => {
        const plan = makeSessionDetailQueryPlan(UUID, { date: start });

        expect(Object.keys(plan).toSorted()).toStrictEqual(["sessionAt", "username"]);
        expect(plan.sessionAt.time).toStrictEqual(start);
    });

    test("the wrapped plan resolves the timezone once", () => {
        const plan = makeWrappedQueryPlan(UUID, { year: 2025 });

        expect(Object.keys(plan).toSorted()).toStrictEqual(["username", "wrapped"]);
        expect(plan.wrapped.year).toBe(2025);
        // Part of the query key, so the loader and the component must agree on it.
        expect(plan.wrapped.timezone).toBe(
            new Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
    });

    test("the explore plan covers one query per selected player", () => {
        const other = "fedcba98-7654-3210-fedc-ba9876543210";
        const plan = makeHistoryExploreQueryPlan({
            uuids: [UUID, other],
            start,
            end,
            limit: 50,
        });

        expect(plan.history.map((request) => request.uuid)).toStrictEqual([
            UUID,
            other,
        ]);
        expect(plan.usernames.map((request) => request.uuid)).toStrictEqual([
            UUID,
            other,
        ]);
        expect(plan.history.map((request) => request.limit)).toStrictEqual([50, 50]);
    });

    test("the explore plan skips uuids that don't normalize", () => {
        const plan = makeHistoryExploreQueryPlan({
            uuids: ["not-a-uuid", UUID],
            start,
            end,
            limit: 50,
        });

        expect(plan.history.map((request) => request.uuid)).toStrictEqual([UUID]);
    });

    test("prefetchPlan fetches every entry of a plan, arrays included", () => {
        const plan = makeHistoryExploreQueryPlan({
            uuids: [UUID, "fedcba98-7654-3210-fedc-ba9876543210"],
            start,
            end,
            limit: 50,
        });
        const { client, prefetchQuery } = spyClient();

        prefetchPlan(client, plan);

        // Two players, history and username each.
        expect(prefetchQuery).toHaveBeenCalledTimes(4);
        for (const request of [...plan.history, ...plan.usernames]) {
            expect(prefetchQuery).toHaveBeenCalledWith(request.options);
        }
    });

    test.each([
        [
            "session",
            () =>
                makeSessionQueryPlan("not-a-uuid", {
                    timeIntervalDefinition: { type: "until", date: end },
                    trackingStart: start,
                }),
        ],
        [
            "session detail",
            () => makeSessionDetailQueryPlan("not-a-uuid", { date: start }),
        ],
        ["wrapped", () => makeWrappedQueryPlan("not-a-uuid", { year: 2025 })],
    ])("the %s plan fetches nothing for a uuid that won't normalize", (_name, make) => {
        const { client, prefetchQuery } = spyClient();

        prefetchPlan(client, make());

        expect(prefetchQuery).not.toHaveBeenCalled();
    });
});
