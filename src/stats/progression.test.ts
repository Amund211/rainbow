import test from "node:test";
import assert from "node:assert";
import { computeStatProgression } from "./progression.ts";
import { type PlayerDataPIT } from "#queries/playerdata.ts";
import { type History } from "#queries/history.ts";

await test("computeStatProgression", async (t) => {
    await t.test(
        "FKDR progression with 0 final deaths (player with very high FKDR gaining kills without dying)",
        () => {
            // This test reproduces the bug from the production case:
            // Player with 4185 FKDR (4077 kills, 1 death -> 4185 kills, 1 death)
            // gained 108 kills with 0 deaths over 301 days
            const startDate = new Date("2025-03-03T02:38:44.798Z");
            const endDate = new Date("2025-12-29T17:36:56.187Z");

            const startStats: PlayerDataPIT = {
                uuid: "test-uuid",
                queriedAt: startDate,
                experience: 1000000,
                solo: {
                    winstreak: null,
                    gamesPlayed: 1000,
                    wins: 500,
                    losses: 500,
                    bedsBroken: 600,
                    bedsLost: 400,
                    finalKills: 4077,
                    finalDeaths: 1,
                    kills: 10000,
                    deaths: 2000,
                },
                doubles: {
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
                },
                threes: {
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
                },
                fours: {
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
                },
                overall: {
                    winstreak: null,
                    gamesPlayed: 1000,
                    wins: 500,
                    losses: 500,
                    bedsBroken: 600,
                    bedsLost: 400,
                    finalKills: 4077,
                    finalDeaths: 1,
                    kills: 10000,
                    deaths: 2000,
                },
            };

            const endStats: PlayerDataPIT = {
                ...startStats,
                queriedAt: endDate,
                overall: {
                    ...startStats.overall,
                    finalKills: 4185, // Gained 108 kills
                    finalDeaths: 1, // No change in deaths
                },
            };

            const trackingHistory: History = [startStats, endStats];

            const result = computeStatProgression(
                trackingHistory,
                endDate,
                endStats,
                "fkdr",
                "overall",
            );

            // Verify the result is not an error
            assert.ok(!result.error, "Should not return an error");

            if (!result.error) {
                // Player should be trending upward since they gained kills without dying
                assert.strictEqual(
                    result.trendingUpward,
                    true,
                    "Should be trending upward when gaining kills without dying",
                );

                // Next milestone should be higher than current value
                assert.ok(
                    result.nextMilestoneValue > result.currentValue,
                    `Next milestone (${result.nextMilestoneValue}) should be greater than current value (${result.currentValue})`,
                );

                // Current value should be 4185 (final kills with 1 death)
                assert.strictEqual(
                    result.currentValue,
                    4185,
                    "Current FKDR should be 4185",
                );

                // Next milestone should be 4186 (floor(4185) + 1)
                assert.strictEqual(
                    result.nextMilestoneValue,
                    4186,
                    "Next milestone should be 4186",
                );

                // Session quotient should be 108 (gained kills with no deaths)
                if ("sessionQuotient" in result) {
                    assert.strictEqual(
                        result.sessionQuotient,
                        108,
                        "Session quotient should be 108 (gained kills)",
                    );
                }
            }
        },
    );

    await t.test(
        "FKDR progression with 0 final deaths throughout (player with 0 deaths gaining kills)",
        () => {
            // Test case for a player who has never died
            // This tests the linear progression case mentioned in the comment
            const startDate = new Date("2025-01-01T00:00:00.000Z");
            const endDate = new Date("2025-01-11T00:00:00.000Z"); // 10 days later

            const startStats: PlayerDataPIT = {
                uuid: "test-uuid-2",
                queriedAt: startDate,
                experience: 10000,
                solo: {
                    winstreak: null,
                    gamesPlayed: 100,
                    wins: 50,
                    losses: 50,
                    bedsBroken: 60,
                    bedsLost: 40,
                    finalKills: 100,
                    finalDeaths: 0, // Never died
                    kills: 500,
                    deaths: 50,
                },
                doubles: {
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
                },
                threes: {
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
                },
                fours: {
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
                },
                overall: {
                    winstreak: null,
                    gamesPlayed: 100,
                    wins: 50,
                    losses: 50,
                    bedsBroken: 60,
                    bedsLost: 40,
                    finalKills: 100,
                    finalDeaths: 0, // Never died
                    kills: 500,
                    deaths: 50,
                },
            };

            const endStats: PlayerDataPIT = {
                ...startStats,
                queriedAt: endDate,
                overall: {
                    ...startStats.overall,
                    finalKills: 150, // Gained 50 kills over 10 days (5 per day)
                    finalDeaths: 0, // Still no deaths
                },
            };

            const trackingHistory: History = [startStats, endStats];

            const result = computeStatProgression(
                trackingHistory,
                endDate,
                endStats,
                "fkdr",
                "overall",
            );

            // Verify the result is not an error
            assert.ok(!result.error, "Should not return an error");

            if (!result.error) {
                // Player should be trending upward since they're gaining kills
                assert.strictEqual(
                    result.trendingUpward,
                    true,
                    "Should be trending upward when player has 0 deaths and is gaining kills",
                );

                // Current value should be 150 (final kills with 0 deaths)
                assert.strictEqual(
                    result.currentValue,
                    150,
                    "Current FKDR should be 150 (final kills since deaths = 0)",
                );

                // When both current and session divisor are 0, the code delegates to
                // finalKills progression, which uses magnitude-based milestones
                // For 150, magnitude = 100, so next milestone = 200
                assert.strictEqual(
                    result.nextMilestoneValue,
                    200,
                    "Next milestone should be 200 (magnitude-based for finalKills)",
                );

                // Progress per day should be positive (linear function of final kills)
                assert.ok(
                    result.progressPerDay > 0,
                    "Progress per day should be positive",
                );

                // For a player with 0 deaths, FKDR progression is linear with final kills
                // They gained 50 kills in 10 days = 5 kills/day
                if ("dividendPerDay" in result) {
                    assert.strictEqual(
                        result.dividendPerDay,
                        5,
                        "Should gain 5 final kills per day",
                    );
                }

                if ("divisorPerDay" in result) {
                    assert.strictEqual(
                        result.divisorPerDay,
                        0,
                        "Should gain 0 final deaths per day",
                    );
                }

                // Days until milestone should be finite
                assert.ok(
                    Number.isFinite(result.daysUntilMilestone),
                    "Days until milestone should be finite",
                );

                // Should take 10 days to gain 50 more kills (at 5 kills/day) to reach 200
                assert.strictEqual(
                    result.daysUntilMilestone,
                    10,
                    "Should take 10 days to reach 200 FKDR (50 kills at 5/day)",
                );
            }
        },
    );
});
