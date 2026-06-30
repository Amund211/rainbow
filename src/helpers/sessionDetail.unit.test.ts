import { describe, expect, test } from "vitest";

import type { PlayerDataPIT, StatsPIT } from "#queries/playerdata.ts";
import type {
    Gamemode,
    GameOutcome,
    GameResult,
    GameSegment,
} from "#queries/sessionAt.ts";
import type { Session } from "#queries/sessions.ts";
import { bedwarsLevelFromExp } from "#stats/stars.ts";

import type { ModeStats } from "./sessionDetail.ts";
import {
    aggregate,
    bestGame,
    fastestWin,
    fkdrTrajectory,
    formatLong,
    inferredGameCount,
    modeBreakdown,
    trailingStreak,
} from "./sessionDetail.ts";

const ZERO_STATS: StatsPIT = {
    winstreak: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bedsBroken: 0,
    bedsLost: 0,
    finalKills: 0,
    finalDeaths: 0,
    kills: 0,
    deaths: 0,
};

const PLACEHOLDER_PIT: PlayerDataPIT = {
    uuid: "00000000-0000-0000-0000-000000000000",
    queriedAt: new Date(1_700_000_000_000),
    experience: 0,
    solo: ZERO_STATS,
    doubles: ZERO_STATS,
    threes: ZERO_STATS,
    fours: ZERO_STATS,
    overall: ZERO_STATS,
};

const makeStats = (overrides: Partial<StatsPIT>): StatsPIT => ({
    ...ZERO_STATS,
    ...overrides,
});

const makePIT = (overrides: Partial<PlayerDataPIT>): PlayerDataPIT => ({
    ...PLACEHOLDER_PIT,
    ...overrides,
});

const makeSession = (start: PlayerDataPIT, end: PlayerDataPIT): Session => ({
    start,
    end,
    extrapolated: false,
    consecutive: true,
    ongoing: false,
});

const makeGame = (overrides: Partial<GameResult>): GameResult => ({
    gamemode: "fours",
    outcome: "win",
    finalKills: 0,
    finalDeath: false,
    bedsBroken: 0,
    bedLost: false,
    kills: 0,
    deaths: 0,
    experience: 0,
    ...overrides,
});

const makeSegment = (
    game: GameResult | null,
    start: PlayerDataPIT = PLACEHOLDER_PIT,
    end: PlayerDataPIT = PLACEHOLDER_PIT,
): GameSegment => ({ start, end, game });

describe(bestGame, () => {
    const cases: {
        name: string;
        // null = an ambiguous (no-game / multi-game) segment
        games: (Partial<GameResult> | null)[];
        // index of the expected best segment, or null when none
        expected: number | null;
    }[] = [
        { name: "no segments", games: [], expected: null },
        { name: "only ambiguous segments", games: [null, null], expected: null },
        { name: "single game", games: [{ finalKills: 3 }], expected: 0 },
        {
            name: "picks the most final kills",
            games: [{ finalKills: 2 }, { finalKills: 5 }, { finalKills: 4 }],
            expected: 1,
        },
        {
            name: "skips ambiguous segments",
            games: [{ finalKills: 5 }, null, { finalKills: 3 }],
            expected: 0,
        },
        {
            name: "final kills beat a cleaner game with fewer kills",
            games: [
                { finalKills: 6, finalDeath: true },
                { finalKills: 5, finalDeath: false },
            ],
            expected: 0,
        },
        {
            name: "tie on kills breaks toward no final death",
            games: [
                { finalKills: 5, finalDeath: true },
                { finalKills: 5, finalDeath: false },
            ],
            expected: 1,
        },
        {
            name: "tie on kills + final death breaks toward no bed lost",
            games: [
                { finalKills: 5, finalDeath: true, bedLost: true },
                { finalKills: 5, finalDeath: true, bedLost: false },
            ],
            expected: 1,
        },
        {
            name: "full tie keeps the earliest game",
            games: [
                { finalKills: 5, finalDeath: false, bedLost: false },
                { finalKills: 5, finalDeath: false, bedLost: false },
            ],
            expected: 0,
        },
    ];

    test.each(cases)("$name", ({ games, expected }) => {
        const segments = games.map((game) =>
            makeSegment(game === null ? null : makeGame(game)),
        );
        const result = bestGame(segments);
        if (expected === null) {
            expect(result).toBeUndefined();
        } else {
            expect(result).toBe(segments[expected]);
        }
    });
});

describe(fastestWin, () => {
    // Each spec is [outcome | null (= gap), durationMinutes].
    const segOf = ([outcome, mins]: readonly [
        GameOutcome | null,
        number,
    ]): GameSegment =>
        makeSegment(
            outcome === null ? null : makeGame({ outcome }),
            makePIT({ queriedAt: new Date(0) }),
            makePIT({ queriedAt: new Date(mins * 60_000) }),
        );

    const cases: {
        name: string;
        segs: [GameOutcome | null, number][];
        expected: number | null;
    }[] = [
        { name: "no segments", segs: [], expected: null },
        {
            name: "no wins",
            segs: [
                ["loss", 5],
                [null, 3],
            ],
            expected: null,
        },
        {
            name: "picks the shortest win",
            segs: [
                ["win", 10],
                ["win", 4],
                ["win", 7],
            ],
            expected: 1,
        },
        {
            name: "ignores losses and gaps",
            segs: [
                ["loss", 1],
                [null, 2],
                ["win", 8],
            ],
            expected: 2,
        },
        {
            name: "tie on duration keeps the earliest win",
            segs: [
                ["win", 5],
                ["win", 5],
            ],
            expected: 0,
        },
    ];

    test.each(cases)("$name", ({ segs, expected }) => {
        const segments = segs.map(segOf);
        const result = fastestWin(segments);
        if (expected === null) {
            expect(result).toBeUndefined();
        } else {
            expect(result).toBe(segments[expected]);
        }
    });
});

describe(trailingStreak, () => {
    const cases: {
        name: string;
        // null = an ambiguous segment (breaks the streak)
        outcomes: (GameOutcome | null)[];
        expected: { length: number; outcome: GameOutcome } | null;
    }[] = [
        { name: "empty", outcomes: [], expected: null },
        { name: "single game is not a streak", outcomes: ["win"], expected: null },
        {
            name: "two trailing wins",
            outcomes: ["win", "win"],
            expected: { length: 2, outcome: "win" },
        },
        {
            name: "counts only the trailing run",
            outcomes: ["loss", "win", "win", "win"],
            expected: { length: 3, outcome: "win" },
        },
        {
            name: "an opposite result breaks the streak",
            outcomes: ["win", "loss", "win"],
            expected: null,
        },
        {
            name: "a gap breaks the streak",
            outcomes: ["win", null, "win", "win"],
            expected: { length: 2, outcome: "win" },
        },
        {
            name: "a trailing gap means no streak",
            outcomes: ["win", "win", null],
            expected: null,
        },
        {
            name: "all losses",
            outcomes: ["loss", "loss", "loss"],
            expected: { length: 3, outcome: "loss" },
        },
        {
            name: "draws form a streak internally",
            outcomes: ["draw", "draw"],
            expected: { length: 2, outcome: "draw" },
        },
    ];

    test.each(cases)("$name", ({ outcomes, expected }) => {
        const segments = outcomes.map((outcome) =>
            makeSegment(outcome === null ? null : makeGame({ outcome })),
        );
        expect(trailingStreak(segments)).toStrictEqual(expected);
    });
});

describe(inferredGameCount, () => {
    const pitWithGames = (perMode: Partial<Record<Gamemode, number>>): PlayerDataPIT =>
        makePIT({
            solo: makeStats({ gamesPlayed: perMode.solo ?? 0 }),
            doubles: makeStats({ gamesPlayed: perMode.doubles ?? 0 }),
            threes: makeStats({ gamesPlayed: perMode.threes ?? 0 }),
            fours: makeStats({ gamesPlayed: perMode.fours ?? 0 }),
        });

    const cases: {
        name: string;
        start: Partial<Record<Gamemode, number>>;
        end: Partial<Record<Gamemode, number>>;
        expected: number;
    }[] = [
        { name: "no movement", start: {}, end: {}, expected: 0 },
        { name: "single mode +1", start: {}, end: { fours: 1 }, expected: 1 },
        {
            name: "sums positive deltas across modes",
            start: {},
            end: { solo: 2, fours: 1 },
            expected: 3,
        },
        {
            name: "a +2 jump in one mode",
            start: {},
            end: { threes: 2 },
            expected: 2,
        },
        {
            name: "ignores negative deltas",
            start: { solo: 5 },
            end: { solo: 3, fours: 1 },
            expected: 1,
        },
    ];

    test.each(cases)("$name", ({ start, end, expected }) => {
        const segment = makeSegment(null, pitWithGames(start), pitWithGames(end));
        expect(inferredGameCount(segment)).toBe(expected);
    });
});

describe(formatLong, () => {
    const cases: { name: string; ms: number; expected: string }[] = [
        { name: "zero", ms: 0, expected: "0m" },
        { name: "negative clamps to 0m", ms: -5000, expected: "0m" },
        { name: "rounds to the nearest minute", ms: 100_000, expected: "2m" },
        { name: "minutes only", ms: 45 * 60_000, expected: "45m" },
        { name: "hours zero-pad the minutes", ms: 65 * 60_000, expected: "1h 05m" },
        { name: "ninety minutes", ms: 90 * 60_000, expected: "1h 30m" },
        { name: "days and hours", ms: 25 * 60 * 60_000, expected: "1d 1h" },
    ];

    test.each(cases)("$name", ({ ms, expected }) => {
        expect(formatLong(ms)).toBe(expected);
    });
});

describe(aggregate, () => {
    test("computes deltas, ratios, xp, stars and elapsed time", () => {
        const start = makePIT({
            experience: 1_000_000,
            queriedAt: new Date(1_700_000_000_000),
            overall: makeStats({
                gamesPlayed: 100,
                wins: 60,
                losses: 40,
                finalKills: 200,
                finalDeaths: 50,
                bedsBroken: 80,
                bedsLost: 30,
                kills: 500,
                deaths: 300,
            }),
        });
        const end = makePIT({
            experience: 1_100_000,
            queriedAt: new Date(1_700_000_000_000 + 3_600_000),
            overall: makeStats({
                gamesPlayed: 110,
                wins: 66,
                losses: 44,
                finalKills: 230,
                finalDeaths: 60,
                bedsBroken: 90,
                bedsLost: 35,
                kills: 560,
                deaths: 330,
            }),
        });

        expect(aggregate(makeSession(start, end))).toStrictEqual({
            games: 10,
            wins: 6,
            losses: 4,
            fk: 30,
            fd: 10,
            bb: 10,
            bl: 5,
            k: 60,
            d: 30,
            xp: 100_000,
            stars: bedwarsLevelFromExp(1_100_000) - bedwarsLevelFromExp(1_000_000),
            fkdr: 3,
            lifetimeFkdr: 4,
            winRate: 0.6,
            lifetimeWR: 0.6,
            elapsedMs: 3_600_000,
        });
    });

    test("ratios fall back to the numerator when the denominator is zero", () => {
        const start = makePIT({ overall: ZERO_STATS });
        const end = makePIT({
            overall: makeStats({
                gamesPlayed: 5,
                wins: 5,
                finalKills: 12,
                finalDeaths: 0,
            }),
        });

        const result = aggregate(makeSession(start, end));
        // No final deaths this session -> FKDR is just the final kills.
        expect(result.fkdr).toBe(12);
        // No lifetime games yet -> lifetime ratios are their numerators (0).
        expect(result.lifetimeFkdr).toBe(0);
        expect(result.lifetimeWR).toBe(0);
        expect(result.winRate).toBe(1);
    });
});

describe(modeBreakdown, () => {
    const ZERO_MODE: ModeStats = {
        games: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        fk: 0,
        fd: 0,
        fkdr: 0,
        bb: 0,
        bl: 0,
        k: 0,
        d: 0,
        kdr: 0,
    };

    test("computes per-mode deltas and ratios, leaving unplayed modes at zero", () => {
        const start = makePIT({
            doubles: makeStats({
                gamesPlayed: 10,
                wins: 6,
                losses: 4,
                finalKills: 20,
                finalDeaths: 10,
                bedsBroken: 8,
                bedsLost: 3,
                kills: 50,
                deaths: 30,
            }),
        });
        const end = makePIT({
            doubles: makeStats({
                gamesPlayed: 12,
                wins: 7,
                losses: 5,
                finalKills: 26,
                finalDeaths: 12,
                bedsBroken: 10,
                bedsLost: 4,
                kills: 60,
                deaths: 33,
            }),
            // No final deaths in threes -> FKDR falls back to final kills.
            threes: makeStats({
                gamesPlayed: 1,
                wins: 1,
                finalKills: 5,
                finalDeaths: 0,
            }),
        });

        const data = modeBreakdown(makeSession(start, end));

        expect(data.doubles).toStrictEqual({
            games: 2,
            wins: 1,
            losses: 1,
            winRate: 0.5,
            fk: 6,
            fd: 2,
            fkdr: 3,
            bb: 2,
            bl: 1,
            k: 10,
            d: 3,
            kdr: 10 / 3,
        });
        expect(data.threes).toStrictEqual({
            games: 1,
            wins: 1,
            losses: 0,
            winRate: 1,
            fk: 5,
            fd: 0,
            fkdr: 5,
            bb: 0,
            bl: 0,
            k: 0,
            d: 0,
            kdr: 0,
        });
        expect(data.solo).toStrictEqual(ZERO_MODE);
        expect(data.fours).toStrictEqual(ZERO_MODE);
    });
});

describe(fkdrTrajectory, () => {
    const endWith = (finalKills: number, finalDeaths: number): GameSegment =>
        makeSegment(
            null,
            PLACEHOLDER_PIT,
            makePIT({ overall: makeStats({ finalKills, finalDeaths }) }),
        );

    test("returns no points for an empty session", () => {
        const session = makeSession(PLACEHOLDER_PIT, PLACEHOLDER_PIT);
        expect(fkdrTrajectory(session, [])).toStrictEqual([]);
    });

    test("tracks cumulative session FKDR against running lifetime FKDR", () => {
        const start = makePIT({
            overall: makeStats({ finalKills: 10, finalDeaths: 5 }),
        });
        const session = makeSession(start, PLACEHOLDER_PIT);
        const segments = [
            endWith(20, 10), // session (10/5)=2,  lifetime (20/10)=2
            endWith(40, 10), // session (30/5)=6,  lifetime (40/10)=4
            endWith(15, 5), // session (5/0)=5 (no deaths), lifetime (15/5)=3
        ];

        expect(fkdrTrajectory(session, segments)).toStrictEqual([
            { x: 1, sessionFkdr: 2, lifetimeFkdr: 2 },
            { x: 2, sessionFkdr: 6, lifetimeFkdr: 4 },
            { x: 3, sessionFkdr: 5, lifetimeFkdr: 3 },
        ]);
    });
});
