import { describe, expect, test } from "vitest";

import type { PlayerDataPIT, StatsPIT } from "#queries/playerdata.ts";
import type { GameResult, GameSegment } from "#queries/sessionAt.ts";

import { bestGame } from "./sessionDetail.ts";

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

// bestGame only reads `segment.game`, so start/end are placeholders.
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

const makeSegment = (game: GameResult | null): GameSegment => ({
    start: PLACEHOLDER_PIT,
    end: PLACEHOLDER_PIT,
    game,
});

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
