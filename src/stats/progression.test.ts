import test from "node:test";
import assert from "node:assert";
import {
    computeStatProgression,
    ERR_NO_DATA,
    ERR_TRACKING_STARTED,
} from "./progression.ts";
import type { PlayerDataPIT, StatsPIT } from "#queries/playerdata.ts";
import type { GamemodeKey, StatKey } from "./keys.ts";

/**
 * Fluid interface builder for StatsPIT objects
 */
class StatsPITBuilder {
    private stats: StatsPIT = {
        winstreak: null,
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

    withWinstreak(value: number | null): this {
        this.stats.winstreak = value;
        return this;
    }

    withGamesPlayed(value: number): this {
        this.stats.gamesPlayed = value;
        return this;
    }

    withWins(value: number): this {
        this.stats.wins = value;
        return this;
    }

    withLosses(value: number): this {
        this.stats.losses = value;
        return this;
    }

    withBedsBroken(value: number): this {
        this.stats.bedsBroken = value;
        return this;
    }

    withBedsLost(value: number): this {
        this.stats.bedsLost = value;
        return this;
    }

    withFinalKills(value: number): this {
        this.stats.finalKills = value;
        return this;
    }

    withFinalDeaths(value: number): this {
        this.stats.finalDeaths = value;
        return this;
    }

    withKills(value: number): this {
        this.stats.kills = value;
        return this;
    }

    withDeaths(value: number): this {
        this.stats.deaths = value;
        return this;
    }

    build(): StatsPIT {
        return { ...this.stats };
    }
}

/**
 * Fluid interface builder for PlayerDataPIT objects
 */
class PlayerDataPITBuilder {
    private data: PlayerDataPIT;

    constructor(uuid: string, queriedAt: Date) {
        const defaultStats: StatsPIT = {
            winstreak: null,
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

        this.data = {
            uuid,
            queriedAt,
            experience: 0,
            solo: { ...defaultStats },
            doubles: { ...defaultStats },
            threes: { ...defaultStats },
            fours: { ...defaultStats },
            overall: { ...defaultStats },
        };
    }

    withExperience(value: number): this {
        this.data.experience = value;
        return this;
    }

    withSoloStats(stats: StatsPIT): this {
        this.data.solo = stats;
        return this;
    }

    withDoublesStats(stats: StatsPIT): this {
        this.data.doubles = stats;
        return this;
    }

    withThreesStats(stats: StatsPIT): this {
        this.data.threes = stats;
        return this;
    }

    withFoursStats(stats: StatsPIT): this {
        this.data.fours = stats;
        return this;
    }

    withOverallStats(stats: StatsPIT): this {
        this.data.overall = stats;
        return this;
    }

    withGamemodeStats(gamemode: GamemodeKey, stats: StatsPIT): this {
        this.data[gamemode] = stats;
        return this;
    }

    build(): PlayerDataPIT {
        return { ...this.data };
    }
}

// Helper function to build stats for a specific linear stat key
function buildStatsForLinearStat(
    stat: Exclude<StatKey, "stars" | "fkdr" | "kdr" | "index" | "winstreak">,
    value: number,
): StatsPIT {
    const builder = new StatsPITBuilder();
    switch (stat) {
        case "gamesPlayed":
            return builder.withGamesPlayed(value).build();
        case "wins":
            return builder.withWins(value).build();
        case "losses":
            return builder.withLosses(value).build();
        case "bedsBroken":
            return builder.withBedsBroken(value).build();
        case "bedsLost":
            return builder.withBedsLost(value).build();
        case "finalKills":
            return builder.withFinalKills(value).build();
        case "finalDeaths":
            return builder.withFinalDeaths(value).build();
        case "kills":
            return builder.withKills(value).build();
        case "deaths":
            return builder.withDeaths(value).build();
        case "experience":
            return builder.build();
    }
}

// ============================================================================
// Test Cases
// ============================================================================

const LINEAR_STATS: Exclude<
    StatKey,
    "stars" | "fkdr" | "kdr" | "index" | "winstreak"
>[] = [
    "experience",
    "gamesPlayed",
    "wins",
    "losses",
    "bedsBroken",
    "bedsLost",
    "finalKills",
    "finalDeaths",
    "kills",
    "deaths",
];

const QUOTIENT_STATS: ("fkdr" | "kdr")[] = ["fkdr", "kdr"];

const GAMEMODES: GamemodeKey[] = [
    "solo",
    "doubles",
    "threes",
    "fours",
    "overall",
];

await test("computeStatProgression - error cases", async (t) => {
    const uuid = "test-uuid";
    const trackingEnd = new Date("2024-02-01T00:00:00Z");

    await t.test("ERR_NO_DATA - undefined history", () => {
        const result = computeStatProgression(
            undefined,
            trackingEnd,
            undefined,
            "experience",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, ERR_NO_DATA);
    });

    await t.test("ERR_NO_DATA - empty history", () => {
        const result = computeStatProgression(
            [],
            trackingEnd,
            undefined,
            "experience",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, ERR_NO_DATA);
    });

    await t.test("ERR_TRACKING_STARTED - single data point", () => {
        const start = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-01T00:00:00Z"),
        ).build();

        const result = computeStatProgression(
            [start],
            trackingEnd,
            undefined,
            "experience",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, ERR_TRACKING_STARTED);
    });

    await t.test("error - more than 2 data points", () => {
        const start = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-01T00:00:00Z"),
        ).build();
        const mid = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-15T00:00:00Z"),
        ).build();
        const end = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-31T00:00:00Z"),
        ).build();

        const result = computeStatProgression(
            [start, mid, end],
            trackingEnd,
            undefined,
            "experience",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, "Expected at most 2 data points");
    });

    await t.test("error - no current stats", () => {
        const start = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-01T00:00:00Z"),
        ).build();
        const end = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-31T00:00:00Z"),
        ).build();

        const result = computeStatProgression(
            [start, end],
            trackingEnd,
            undefined,
            "experience",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, "No current stats");
    });

    await t.test("error - index not implemented", () => {
        const start = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-01T00:00:00Z"),
        )
            .withExperience(1000)
            .build();
        const end = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-31T00:00:00Z"),
        )
            .withExperience(2000)
            .build();
        const current = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-02-01T00:00:00Z"),
        )
            .withExperience(2100)
            .build();

        const result = computeStatProgression(
            [start, end],
            trackingEnd,
            current,
            "index",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, "Not implemented");
    });

    await t.test("error - winstreak not implemented", () => {
        const start = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-01T00:00:00Z"),
        )
            .withOverallStats(new StatsPITBuilder().withWinstreak(5).build())
            .build();
        const end = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-01-31T00:00:00Z"),
        )
            .withOverallStats(new StatsPITBuilder().withWinstreak(10).build())
            .build();
        const current = new PlayerDataPITBuilder(
            uuid,
            new Date("2024-02-01T00:00:00Z"),
        )
            .withOverallStats(new StatsPITBuilder().withWinstreak(12).build())
            .build();

        const result = computeStatProgression(
            [start, end],
            trackingEnd,
            current,
            "winstreak",
            "overall",
        );
        assert.strictEqual(result.error, true);
        assert.strictEqual(result.reason, "Not implemented");
    });
});

await test("computeStatProgression - linear stats", async (t) => {
    const uuid = "test-uuid";

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - normal progression`, async (t) => {
            for (const stat of LINEAR_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withExperience(stat === "experience" ? 10000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 100),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withExperience(stat === "experience" ? 40000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 400),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withExperience(stat === "experience" ? 45000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 450),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success, got error: ${result.reason}`,
                        );
                    }

                    const progression = result;
                    assert.strictEqual(progression.stat, stat);
                    assert.strictEqual(progression.trendingUpward, true);

                    const expectedValue = stat === "experience" ? 45000 : 450;
                    assert.strictEqual(progression.currentValue, expectedValue);

                    // Days: startDate to trackingEnd = 31 days
                    const daysElapsed = 31;
                    const expectedProgressPerDay =
                        stat === "experience"
                            ? (40000 - 10000) / daysElapsed
                            : (400 - 100) / daysElapsed;
                    assert.ok(
                        Math.abs(
                            progression.progressPerDay - expectedProgressPerDay,
                        ) < 0.01,
                    );

                    assert.ok(
                        progression.nextMilestoneValue >
                            progression.currentValue,
                    );
                    assert.ok(progression.daysUntilMilestone > 0);
                    assert.ok(progression.daysUntilMilestone < Infinity);
                });
            }
        });
    }

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - no progress edge case`, async (t) => {
            for (const stat of LINEAR_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withExperience(stat === "experience" ? 10000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 100),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withExperience(stat === "experience" ? 10000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 100),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withExperience(stat === "experience" ? 10000 : 0)
                        .withGamemodeStats(
                            gamemode,
                            buildStatsForLinearStat(stat, 100),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    assert.strictEqual(result.error, true);
                    assert.strictEqual(result.reason, "No progress");
                });
            }
        });
    }
});

await test("computeStatProgression - quotient stats (fkdr, kdr)", async (t) => {
    const uuid = "test-uuid";

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - normal progression`, async (t) => {
            for (const stat of QUOTIENT_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const isFkdr = stat === "fkdr";

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(100)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(100)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(400)
                                      .withFinalDeaths(100)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(400)
                                      .withDeaths(100)
                                      .build(),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(450)
                                      .withFinalDeaths(105)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(450)
                                      .withDeaths(105)
                                      .build(),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success, got error: ${result.reason}`,
                        );
                    }

                    const progression = result;
                    assert.strictEqual(progression.stat, stat);

                    const currentRatio = 450 / 105;
                    assert.ok(
                        Math.abs(progression.currentValue - currentRatio) <
                            0.01,
                    );

                    if ("sessionQuotient" in progression) {
                        assert.ok(
                            Math.abs(progression.sessionQuotient - 6.0) < 0.01,
                        );
                    }

                    assert.strictEqual(progression.nextMilestoneValue, 5);
                    assert.strictEqual(progression.trendingUpward, true);
                    assert.ok(progression.daysUntilMilestone > 0);
                    assert.ok(progression.daysUntilMilestone < Infinity);
                });
            }
        });
    }

    for (const gamemode of GAMEMODES) {
        await t.test(
            `${gamemode} - zero current divisor, non-zero session divisor`,
            async (t) => {
                for (const stat of QUOTIENT_STATS) {
                    await t.test(stat, () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-31T00:00:00Z");
                        const trackingEnd = new Date("2024-02-01T00:00:00Z");

                        const isFkdr = stat === "fkdr";

                        const start = new PlayerDataPITBuilder(uuid, startDate)
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(100)
                                          .withFinalDeaths(0)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(100)
                                          .withDeaths(0)
                                          .build(),
                            )
                            .build();

                        const end = new PlayerDataPITBuilder(uuid, endDate)
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(400)
                                          .withFinalDeaths(50)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(400)
                                          .withDeaths(50)
                                          .build(),
                            )
                            .build();

                        const current = new PlayerDataPITBuilder(
                            uuid,
                            trackingEnd,
                        )
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(450)
                                          .withFinalDeaths(55)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(450)
                                          .withDeaths(55)
                                          .build(),
                            )
                            .build();

                        const result = computeStatProgression(
                            [start, end],
                            trackingEnd,
                            current,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success, got error: ${result.reason}`,
                            );
                        }

                        const progression = result;
                        assert.strictEqual(progression.stat, stat);

                        const currentRatio = 450 / 55;
                        assert.ok(
                            Math.abs(progression.currentValue - currentRatio) <
                                0.01,
                        );

                        if ("sessionQuotient" in progression) {
                            assert.ok(
                                Math.abs(progression.sessionQuotient - 6.0) <
                                    0.01,
                            );
                        }
                    });
                }
            },
        );
    }

    for (const gamemode of GAMEMODES) {
        await t.test(
            `${gamemode} - zero divisor (both current and session)`,
            async (t) => {
                for (const stat of QUOTIENT_STATS) {
                    await t.test(stat, () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-31T00:00:00Z");
                        const trackingEnd = new Date("2024-02-01T00:00:00Z");

                        const isFkdr = stat === "fkdr";

                        const start = new PlayerDataPITBuilder(uuid, startDate)
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(100)
                                          .withFinalDeaths(0)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(100)
                                          .withDeaths(0)
                                          .build(),
                            )
                            .build();

                        const end = new PlayerDataPITBuilder(uuid, endDate)
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(400)
                                          .withFinalDeaths(0)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(400)
                                          .withDeaths(0)
                                          .build(),
                            )
                            .build();

                        const current = new PlayerDataPITBuilder(
                            uuid,
                            trackingEnd,
                        )
                            .withGamemodeStats(
                                gamemode,
                                isFkdr
                                    ? new StatsPITBuilder()
                                          .withFinalKills(450)
                                          .withFinalDeaths(0)
                                          .build()
                                    : new StatsPITBuilder()
                                          .withKills(450)
                                          .withDeaths(0)
                                          .build(),
                            )
                            .build();

                        const result = computeStatProgression(
                            [start, end],
                            trackingEnd,
                            current,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success, got error: ${result.reason}`,
                            );
                        }

                        const progression = result;
                        assert.strictEqual(progression.stat, stat);
                        assert.strictEqual(progression.currentValue, 450);
                        assert.strictEqual(progression.trendingUpward, true);
                    });
                }
            },
        );
    }

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - no progress edge case`, async (t) => {
            for (const stat of QUOTIENT_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const isFkdr = stat === "fkdr";

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(100)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(100)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(100)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(100)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(100)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(100)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success, got error: ${result.reason}`,
                        );
                    }

                    const progression = result;
                    assert.strictEqual(progression.stat, stat);
                    assert.strictEqual(
                        progression.daysUntilMilestone,
                        Infinity,
                    );
                    assert.strictEqual(progression.progressPerDay, 0);
                });
            }
        });
    }

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - trending downward`, async (t) => {
            for (const stat of QUOTIENT_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const isFkdr = stat === "fkdr";

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(500)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(500)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(600)
                                      .withFinalDeaths(200)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(600)
                                      .withDeaths(200)
                                      .build(),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(610)
                                      .withFinalDeaths(205)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(610)
                                      .withDeaths(205)
                                      .build(),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success, got error: ${result.reason}`,
                        );
                    }

                    const progression = result;
                    assert.strictEqual(progression.stat, stat);

                    const currentRatio = 610 / 205;
                    assert.ok(
                        Math.abs(progression.currentValue - currentRatio) <
                            0.01,
                    );

                    if ("sessionQuotient" in progression) {
                        const sessionQuotient = 100 / 150;
                        assert.ok(
                            Math.abs(
                                progression.sessionQuotient - sessionQuotient,
                            ) < 0.01,
                        );
                    }

                    assert.strictEqual(progression.trendingUpward, false);
                    assert.strictEqual(progression.nextMilestoneValue, 2);
                });
            }
        });
    }

    for (const gamemode of GAMEMODES) {
        await t.test(`${gamemode} - milestone unreachable`, async (t) => {
            for (const stat of QUOTIENT_STATS) {
                await t.test(stat, () => {
                    const startDate = new Date("2024-01-01T00:00:00Z");
                    const endDate = new Date("2024-01-31T00:00:00Z");
                    const trackingEnd = new Date("2024-02-01T00:00:00Z");

                    const isFkdr = stat === "fkdr";

                    const start = new PlayerDataPITBuilder(uuid, startDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(100)
                                      .withFinalDeaths(50)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(100)
                                      .withDeaths(50)
                                      .build(),
                        )
                        .build();

                    const end = new PlayerDataPITBuilder(uuid, endDate)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(250)
                                      .withFinalDeaths(100)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(250)
                                      .withDeaths(100)
                                      .build(),
                        )
                        .build();

                    const current = new PlayerDataPITBuilder(uuid, trackingEnd)
                        .withGamemodeStats(
                            gamemode,
                            isFkdr
                                ? new StatsPITBuilder()
                                      .withFinalKills(260)
                                      .withFinalDeaths(104)
                                      .build()
                                : new StatsPITBuilder()
                                      .withKills(260)
                                      .withDeaths(104)
                                      .build(),
                        )
                        .build();

                    const result = computeStatProgression(
                        [start, end],
                        trackingEnd,
                        current,
                        stat,
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success, got error: ${result.reason}`,
                        );
                    }

                    const progression = result;
                    assert.strictEqual(progression.stat, stat);

                    const currentRatio = 260 / 104;
                    assert.ok(
                        Math.abs(progression.currentValue - currentRatio) <
                            0.01,
                    );

                    if ("sessionQuotient" in progression) {
                        assert.ok(
                            Math.abs(progression.sessionQuotient - 3.0) < 0.01,
                        );
                    }

                    assert.strictEqual(progression.nextMilestoneValue, 3);
                    assert.strictEqual(
                        progression.daysUntilMilestone,
                        Infinity,
                    );
                });
            }
        });
    }
});

await test("computeStatProgression - stars stat", async (t) => {
    const uuid = "test-uuid";

    await t.test("normal progression", () => {
        const startDate = new Date("2024-01-01T00:00:00Z");
        const endDate = new Date("2024-01-31T00:00:00Z");
        const trackingEnd = new Date("2024-02-01T00:00:00Z");

        const PRESTIGE_EXP = 487000;

        const start = new PlayerDataPITBuilder(uuid, startDate)
            .withExperience(PRESTIGE_EXP)
            .build();

        const end = new PlayerDataPITBuilder(uuid, endDate)
            .withExperience(2 * PRESTIGE_EXP)
            .build();

        const current = new PlayerDataPITBuilder(uuid, trackingEnd)
            .withExperience(2 * PRESTIGE_EXP + 0.1 * PRESTIGE_EXP)
            .build();

        const result = computeStatProgression(
            [start, end],
            trackingEnd,
            current,
            "stars",
            "overall",
        );

        if (result.error) {
            assert.fail(`Expected success, got error: ${result.reason}`);
        }

        const progression = result;
        assert.strictEqual(progression.stat, "stars");
        assert.strictEqual(progression.trendingUpward, true);
        assert.strictEqual(progression.nextMilestoneValue, 300);
        assert.ok(progression.daysUntilMilestone > 0);
        assert.ok(progression.daysUntilMilestone < Infinity);
    });
});

await test("computeStatProgression - edge case: very large values", async (t) => {
    const uuid = "test-uuid";

    await t.test("very large stat values", () => {
        const startDate = new Date("2024-01-01T00:00:00Z");
        const endDate = new Date("2024-01-31T00:00:00Z");
        const trackingEnd = new Date("2024-02-01T00:00:00Z");

        const start = new PlayerDataPITBuilder(uuid, startDate)
            .withOverallStats(new StatsPITBuilder().withKills(1000000).build())
            .build();

        const end = new PlayerDataPITBuilder(uuid, endDate)
            .withOverallStats(new StatsPITBuilder().withKills(2000000).build())
            .build();

        const current = new PlayerDataPITBuilder(uuid, trackingEnd)
            .withOverallStats(new StatsPITBuilder().withKills(2100000).build())
            .build();

        const result = computeStatProgression(
            [start, end],
            trackingEnd,
            current,
            "kills",
            "overall",
        );

        if (result.error) {
            assert.fail(`Expected success, got error: ${result.reason}`);
        }

        const progression = result;
        assert.strictEqual(progression.stat, "kills");
        assert.ok(progression.nextMilestoneValue > progression.currentValue);
    });
});
