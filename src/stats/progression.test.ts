import test from "node:test";
import assert from "node:assert";
import {
    computeStatProgression,
    ERR_NO_DATA,
    ERR_TRACKING_STARTED,
} from "./progression.ts";
import { type PlayerDataPIT, type StatsPIT } from "#queries/playerdata.ts";
import { type History } from "#queries/history.ts";
import { ALL_GAMEMODE_KEYS, type GamemodeKey, type StatKey } from "./keys.ts";

const TEST_UUID = "0123e456-7890-1234-5678-90abcdef1234";

class StatsBuilder {
    private stats: StatsPIT;

    constructor() {
        this.stats = {
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
    }

    withStat(stat: "winstreak", value: number | null): this;
    withStat(
        stat: Exclude<
            StatKey,
            "winstreak" | "fkdr" | "kdr" | "index" | "stars" | "experience"
        >,
        value: number,
    ): this;
    withStat(
        stat: Exclude<
            StatKey,
            "fkdr" | "kdr" | "index" | "stars" | "experience"
        >,
        value: number | null,
    ): this {
        switch (stat) {
            case "gamesPlayed":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.gamesPlayed = value;
                break;
            case "wins":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.wins = value;
                break;
            case "losses":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.losses = value;
                break;
            case "bedsBroken":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.bedsBroken = value;
                break;
            case "bedsLost":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.bedsLost = value;
                break;
            case "finalKills":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.finalKills = value;
                break;
            case "finalDeaths":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.finalDeaths = value;
                break;
            case "kills":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.kills = value;
                break;
            case "deaths":
                if (value === null) throw new Error(`${stat} cannot be null`);
                this.stats.deaths = value;
                break;
            case "winstreak":
                this.stats.winstreak = value;
                break;
            default: {
                stat satisfies never;
            }
        }
        return this;
    }

    build(): StatsPIT {
        // Return a copy to prevent mutation
        return { ...this.stats };
    }
}

class PlayerDataBuilder {
    private player: PlayerDataPIT;

    constructor(uuid: string, queriedAt: Date) {
        const emptyStats: StatsPIT = {
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

        this.player = {
            uuid,
            queriedAt,
            experience: 0,
            solo: { ...emptyStats },
            doubles: { ...emptyStats },
            threes: { ...emptyStats },
            fours: { ...emptyStats },
            overall: { ...emptyStats },
        };
    }

    withExperience(experience: number): this {
        this.player.experience = experience;
        return this;
    }

    withGamemodeStats(gamemode: GamemodeKey, stats: StatsPIT): this {
        this.player[gamemode] = { ...stats };
        return this;
    }

    build(): PlayerDataPIT {
        // Return a copy to prevent mutation
        return {
            ...this.player,
            solo: { ...this.player.solo },
            doubles: { ...this.player.doubles },
            threes: { ...this.player.threes },
            fours: { ...this.player.fours },
            overall: { ...this.player.overall },
        };
    }
}

await test("computeStatProgression - error cases", async (t) => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const endDate = new Date("2024-01-02T00:00:00Z");

    const cases: {
        name: string;
        history: History | undefined;
        reason: string;
    }[] = [
        { name: "undefined history", history: undefined, reason: ERR_NO_DATA },
        { name: "empty history", history: [], reason: ERR_NO_DATA },
        {
            name: "one element history",
            history: [new PlayerDataBuilder(TEST_UUID, startDate).build()],
            reason: ERR_TRACKING_STARTED,
        },
        {
            name: "no progress",
            history: [
                new PlayerDataBuilder(TEST_UUID, startDate)
                    .withGamemodeStats(
                        "overall",
                        new StatsBuilder().withStat("wins", 100).build(),
                    )
                    .build(),
                new PlayerDataBuilder(TEST_UUID, endDate)
                    .withGamemodeStats(
                        "overall",
                        new StatsBuilder().withStat("wins", 100).build(),
                    )
                    .build(),
            ],
            reason: "No progress",
        },
        {
            name: "three element history",
            history: [
                new PlayerDataBuilder(TEST_UUID, startDate)
                    .withGamemodeStats(
                        "overall",
                        new StatsBuilder().withStat("wins", 100).build(),
                    )
                    .build(),
                new PlayerDataBuilder(
                    TEST_UUID,
                    new Date("2024-01-01T12:00:00Z"),
                )
                    .withGamemodeStats(
                        "overall",
                        new StatsBuilder().withStat("wins", 150).build(),
                    )
                    .build(),
                new PlayerDataBuilder(TEST_UUID, endDate)
                    .withGamemodeStats(
                        "overall",
                        new StatsBuilder().withStat("wins", 200).build(),
                    )
                    .build(),
            ],
            reason: "Expected at most 2 data points",
        },
    ];

    for (const c of cases) {
        await t.test(`should return error for ${c.name}`, () => {
            const result = computeStatProgression(
                c.history,
                endDate,
                "wins",
                "overall",
            );
            assert.deepStrictEqual(result, {
                error: true,
                reason: c.reason,
            });
        });
    }
});

await test("computeStatProgression - linear gamemode stats", async (t) => {
    // Stats that are linear (not fkdr) and gamemode-specific (not stars)
    const linearGamemodeStats = [
        "gamesPlayed",
        "wins",
        "losses",
        "bedsBroken",
        "bedsLost",
        "finalKills",
        "finalDeaths",
        "kills",
        "deaths",
    ] as const;

    const gamemodes = ALL_GAMEMODE_KEYS;

    for (const gamemode of gamemodes) {
        await t.test(`gamemode: ${gamemode}`, async (t) => {
            for (const stat of linearGamemodeStats) {
                await t.test(`stat: ${stat}`, async (t) => {
                    await t.test("basic - steady progress", () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-11T00:00:00Z"); // 10 days
                        const startBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            startDate,
                        );
                        const endBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            endDate,
                        );
                        startBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 100).build(),
                        );
                        endBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 200).build(), // +100 in 10 days = 10/day
                        );

                        const history: History = [
                            startBuilder.build(),
                            endBuilder.build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 200,
                            progressPerDay: 10,
                            nextMilestoneValue: 300,
                            daysUntilMilestone: 10,
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test("edge case - zero starting value", () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-06T00:00:00Z");
                        const startBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            startDate,
                        );
                        const endBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            endDate,
                        );
                        startBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 0).build(),
                        );
                        endBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 100).build(),
                        );

                        const history: History = [
                            startBuilder.build(),
                            endBuilder.build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 100,
                            progressPerDay: 20,
                            nextMilestoneValue: 200,
                            daysUntilMilestone: 5,
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test("edge case - large values", () => {
                        const startDate = new Date("2025-01-01T00:00:00Z");
                        const endDate = new Date("2025-01-21T00:00:00Z");
                        const startBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            startDate,
                        );
                        const endBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            endDate,
                        );
                        startBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 100000).build(),
                        );
                        endBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 110000).build(),
                        );

                        const history: History = [
                            startBuilder.build(),
                            endBuilder.build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 110000,
                            progressPerDay: 500,
                            nextMilestoneValue: 200000,
                            daysUntilMilestone: 180,
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test("edge case - late tracking end", () => {
                        // The tracking interval usually contains the whole current day
                        // This means we will in general always get a trackingEndDate after endDate
                        // In cases where the Hypixel API is down, this effect can be exacerbated as
                        // the endDate (the date of the last recorded stats instance in the tracking interval)
                        // can be many days old, and not just some hours earlier than trackingEndDate.
                        // This can lead to e.g. predicted milestone dates being earlier than trackingEndDate
                        const startDate = new Date("2025-01-01T00:00:00Z");
                        const endDate = new Date("2025-01-06T00:00:00Z");
                        const trackingEndDate = new Date(
                            "2025-01-11T00:00:00Z",
                        );
                        const startBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            startDate,
                        );
                        const endBuilder = new PlayerDataBuilder(
                            TEST_UUID,
                            endDate,
                        );
                        startBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 100).build(),
                        );
                        endBuilder.withGamemodeStats(
                            gamemode,
                            new StatsBuilder().withStat(stat, 200).build(),
                        );

                        const history: History = [
                            startBuilder.build(),
                            endBuilder.build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            trackingEndDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 200,
                            progressPerDay: 10,
                            nextMilestoneValue: 300,
                            // NOTE: This is from the endDate, so this would be just 5 days after trackingEndDate
                            daysUntilMilestone: 10,
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: trackingEndDate,
                            },
                        });
                    });
                });
            }
        });
    }
});

await test("computeStatProgression - quotient stats", async (t) => {
    const quotientStats = ["fkdr", "kdr"] as const;
    const gamemodes = ALL_GAMEMODE_KEYS;

    type QuotientStatKey = (typeof quotientStats)[number];

    const getDividendStat = (stat: QuotientStatKey) => {
        switch (stat) {
            case "fkdr":
                return "finalKills";
            case "kdr":
                return "kills";
        }
    };

    const getDivisorStat = (stat: QuotientStatKey) => {
        switch (stat) {
            case "fkdr":
                return "finalDeaths";
            case "kdr":
                return "deaths";
        }
    };

    for (const gamemode of gamemodes) {
        await t.test(`gamemode: ${gamemode}`, async (t) => {
            for (const stat of quotientStats) {
                const dividendStat = getDividendStat(stat);
                const divisorStat = getDivisorStat(stat);

                await t.test(`stat: ${stat}`, async (t) => {
                    await t.test("basic - improving quotient", () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-11T00:00:00Z"); // 10 days
                        const startBuilder = new StatsBuilder();
                        const endBuilder = new StatsBuilder();

                        // Start: 100/50 = 2.0
                        // End: 200/75 = 2.66... (improving)
                        startBuilder
                            .withStat(dividendStat, 100)
                            .withStat(divisorStat, 50);
                        endBuilder
                            .withStat(dividendStat, 200)
                            .withStat(divisorStat, 75);

                        const history: History = [
                            new PlayerDataBuilder(TEST_UUID, startDate)
                                .withGamemodeStats(
                                    gamemode,
                                    startBuilder.build(),
                                )
                                .build(),
                            new PlayerDataBuilder(TEST_UUID, endDate)
                                .withGamemodeStats(gamemode, endBuilder.build())
                                .build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 200 / 75,
                            sessionQuotient: 100 / 25,
                            // (Goal - current) / days to reach
                            // NOTE: This will be higher at first and decrease over time,
                            // especially if the session quotient is close to the next milestone,
                            // but this is the current simple way of calculating something sensible here
                            progressPerDay: (3 - 200 / 75) / 10,
                            dividendPerDay: 100 / 10,
                            divisorPerDay: 25 / 10,
                            nextMilestoneValue: 3,
                            daysUntilMilestone: 10, // 100 more dividend and 25 more divisor
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test("basic - declining quotient", () => {
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-11T00:00:00Z");
                        const startBuilder = new StatsBuilder();
                        const endBuilder = new StatsBuilder();

                        // Start: 100/50 = 2.0
                        // End: 150/125 = 1.2 (declining)
                        startBuilder
                            .withStat(dividendStat, 100)
                            .withStat(divisorStat, 50);
                        endBuilder
                            .withStat(dividendStat, 150)
                            .withStat(divisorStat, 125);

                        const history: History = [
                            new PlayerDataBuilder(TEST_UUID, startDate)
                                .withGamemodeStats(
                                    gamemode,
                                    startBuilder.build(),
                                )
                                .build(),
                            new PlayerDataBuilder(TEST_UUID, endDate)
                                .withGamemodeStats(gamemode, endBuilder.build())
                                .build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 150 / 125,
                            sessionQuotient: 50 / 75,
                            // (Goal - current) / days to reach
                            progressPerDay: (1 - 1.2) / 10,
                            dividendPerDay: 50 / 10,
                            divisorPerDay: 75 / 10,
                            nextMilestoneValue: 1,
                            daysUntilMilestone: 10, // 50 more dividend and 75 more divisor
                            trendingUpward: false,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test("edge case - zero divisor overall", () => {
                        // With a zero divisor overall, the quotient is defined as just the dividend
                        // This means that this is equivalent to a linear stat progression on the dividend stat
                        const startDate = new Date("2024-01-01T00:00:00Z");
                        const endDate = new Date("2024-01-11T00:00:00Z");
                        const startBuilder = new StatsBuilder();
                        const endBuilder = new StatsBuilder();

                        // Zero divisor overall (also within tracking interval)
                        startBuilder
                            .withStat(dividendStat, 100)
                            .withStat(divisorStat, 0);
                        endBuilder
                            .withStat(dividendStat, 200)
                            .withStat(divisorStat, 0);

                        const history: History = [
                            new PlayerDataBuilder(TEST_UUID, startDate)
                                .withGamemodeStats(
                                    gamemode,
                                    startBuilder.build(),
                                )
                                .build(),
                            new PlayerDataBuilder(TEST_UUID, endDate)
                                .withGamemodeStats(gamemode, endBuilder.build())
                                .build(),
                        ];

                        const result = computeStatProgression(
                            history,
                            endDate,
                            stat,
                            gamemode,
                        );

                        if (result.error) {
                            assert.fail(
                                `Expected success but got error: ${result.reason}`,
                            );
                        }

                        assert.deepStrictEqual(result, {
                            stat,
                            endValue: 200,
                            sessionQuotient: 100, // Quotient is just dividend when divisor is zero
                            progressPerDay: 10, // Linear progress of dividend
                            dividendPerDay: 10,
                            divisorPerDay: 0,
                            nextMilestoneValue: 300,
                            daysUntilMilestone: 10,
                            trendingUpward: true,
                            trackingDataTimeInterval: {
                                start: startDate,
                                end: endDate,
                            },
                        });
                    });

                    await t.test(
                        "edge case - zero session divisor",
                        async (t) => {
                            // NOTE: Milestones are kind of awkward for high quotients
                            const cases = [
                                {
                                    divisor: 1,
                                    goal: 201, // 200 -> 201
                                    daysToReach: 0.1, // 1 dividend => 1/10 days
                                },
                                {
                                    divisor: 5,
                                    goal: 41, // 40 -> 41
                                    daysToReach: 0.5, // 5 dividend => 5/10 days
                                },
                                {
                                    divisor: 10,
                                    goal: 21, // 20 -> 21
                                    daysToReach: 1, // 10 dividend => 10/10 days
                                },
                                {
                                    divisor: 100,
                                    goal: 3, // 2 -> 3
                                    daysToReach: 10, // 100 dividend => 100/10 days
                                },
                            ];
                            for (const {
                                divisor,
                                goal,
                                daysToReach,
                            } of cases) {
                                await t.test(
                                    `divisor constant at ${divisor.toString()}`,
                                    () => {
                                        // The player did not gain any divisor during the tracking interval
                                        // The quotient will grow linearly with the dividend, divided by the constant divisor
                                        const startDate = new Date(
                                            "2024-01-01T00:00:00Z",
                                        );
                                        const endDate = new Date(
                                            "2024-01-11T00:00:00Z",
                                        );
                                        const startBuilder = new StatsBuilder();
                                        const endBuilder = new StatsBuilder();

                                        startBuilder
                                            .withStat(dividendStat, 100)
                                            .withStat(divisorStat, divisor);
                                        endBuilder
                                            .withStat(dividendStat, 200)
                                            .withStat(divisorStat, divisor);

                                        const history: History = [
                                            new PlayerDataBuilder(
                                                TEST_UUID,
                                                startDate,
                                            )
                                                .withGamemodeStats(
                                                    gamemode,
                                                    startBuilder.build(),
                                                )
                                                .build(),
                                            new PlayerDataBuilder(
                                                TEST_UUID,
                                                endDate,
                                            )
                                                .withGamemodeStats(
                                                    gamemode,
                                                    endBuilder.build(),
                                                )
                                                .build(),
                                        ];

                                        const result = computeStatProgression(
                                            history,
                                            endDate,
                                            stat,
                                            gamemode,
                                        );

                                        if (result.error) {
                                            assert.fail(
                                                `Expected success but got error: ${result.reason}`,
                                            );
                                        }

                                        assert.deepStrictEqual(result, {
                                            stat,
                                            endValue: 200 / divisor,
                                            sessionQuotient: 100, // Quotient is just dividend when divisor is 0
                                            // (goal - current) / days to reach
                                            progressPerDay:
                                                (goal - 200 / divisor) /
                                                daysToReach,
                                            dividendPerDay: 10,
                                            divisorPerDay: 0,
                                            nextMilestoneValue: goal,
                                            daysUntilMilestone: daysToReach,
                                            trendingUpward: true,
                                            trackingDataTimeInterval: {
                                                start: startDate,
                                                end: endDate,
                                            },
                                        });
                                    },
                                );
                            }
                        },
                    );

                    await t.test(
                        "edge case - goal quotient equal to session quotient (up)",
                        () => {
                            const startDate = new Date("2024-01-01T00:00:00Z");
                            const endDate = new Date("2024-01-11T00:00:00Z");
                            const startBuilder = new StatsBuilder();
                            const endBuilder = new StatsBuilder();

                            startBuilder
                                .withStat(dividendStat, 0)
                                .withStat(divisorStat, 5);
                            endBuilder
                                .withStat(dividendStat, 10)
                                .withStat(divisorStat, 10);

                            const history: History = [
                                new PlayerDataBuilder(TEST_UUID, startDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        startBuilder.build(),
                                    )
                                    .build(),
                                new PlayerDataBuilder(TEST_UUID, endDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        endBuilder.build(),
                                    )
                                    .build(),
                            ];

                            const result = computeStatProgression(
                                history,
                                endDate,
                                stat,
                                gamemode,
                            );

                            if (result.error) {
                                assert.fail(
                                    `Expected success but got error: ${result.reason}`,
                                );
                            }

                            assert.deepStrictEqual(result, {
                                stat,
                                endValue: 1,
                                sessionQuotient: 2,
                                progressPerDay: 0,
                                dividendPerDay: 1,
                                divisorPerDay: 0.5,
                                nextMilestoneValue: 2,
                                daysUntilMilestone: Infinity,
                                trendingUpward: true,
                                trackingDataTimeInterval: {
                                    start: startDate,
                                    end: endDate,
                                },
                            });
                        },
                    );

                    await t.test(
                        "edge case - goal quotient equal to session quotient (down)",
                        () => {
                            const startDate = new Date("2024-01-01T00:00:00Z");
                            const endDate = new Date("2024-01-11T00:00:00Z");
                            const startBuilder = new StatsBuilder();
                            const endBuilder = new StatsBuilder();

                            startBuilder
                                .withStat(dividendStat, 5)
                                .withStat(divisorStat, 0);
                            endBuilder
                                .withStat(dividendStat, 10)
                                .withStat(divisorStat, 5);

                            const history: History = [
                                new PlayerDataBuilder(TEST_UUID, startDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        startBuilder.build(),
                                    )
                                    .build(),
                                new PlayerDataBuilder(TEST_UUID, endDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        endBuilder.build(),
                                    )
                                    .build(),
                            ];

                            const result = computeStatProgression(
                                history,
                                endDate,
                                stat,
                                gamemode,
                            );

                            if (result.error) {
                                assert.fail(
                                    `Expected success but got error: ${result.reason}`,
                                );
                            }

                            assert.deepStrictEqual(result, {
                                stat,
                                endValue: 2,
                                sessionQuotient: 1,
                                progressPerDay: 0,
                                dividendPerDay: 0.5,
                                divisorPerDay: 0.5,
                                nextMilestoneValue: 1,
                                daysUntilMilestone: Infinity,
                                trendingUpward: false,
                                trackingDataTimeInterval: {
                                    start: startDate,
                                    end: endDate,
                                },
                            });
                        },
                    );

                    await t.test(
                        "edge case - goal quotient higher than session quotient (up)",
                        () => {
                            const startDate = new Date("2024-01-01T00:00:00Z");
                            const endDate = new Date("2024-01-11T00:00:00Z");
                            const startBuilder = new StatsBuilder();
                            const endBuilder = new StatsBuilder();

                            startBuilder
                                .withStat(dividendStat, 1)
                                .withStat(divisorStat, 5);
                            endBuilder
                                .withStat(dividendStat, 10)
                                .withStat(divisorStat, 10);

                            const history: History = [
                                new PlayerDataBuilder(TEST_UUID, startDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        startBuilder.build(),
                                    )
                                    .build(),
                                new PlayerDataBuilder(TEST_UUID, endDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        endBuilder.build(),
                                    )
                                    .build(),
                            ];

                            const result = computeStatProgression(
                                history,
                                endDate,
                                stat,
                                gamemode,
                            );

                            if (result.error) {
                                assert.fail(
                                    `Expected success but got error: ${result.reason}`,
                                );
                            }

                            assert.deepStrictEqual(result, {
                                stat,
                                endValue: 1,
                                sessionQuotient: 9 / 5,
                                progressPerDay: 0,
                                dividendPerDay: 0.9,
                                divisorPerDay: 0.5,
                                nextMilestoneValue: 2,
                                daysUntilMilestone: Infinity,
                                trendingUpward: true,
                                trackingDataTimeInterval: {
                                    start: startDate,
                                    end: endDate,
                                },
                            });
                        },
                    );

                    await t.test(
                        "edge case - goal quotient lower than session quotient (down)",
                        () => {
                            const startDate = new Date("2024-01-01T00:00:00Z");
                            const endDate = new Date("2024-01-11T00:00:00Z");
                            const startBuilder = new StatsBuilder();
                            const endBuilder = new StatsBuilder();

                            startBuilder
                                .withStat(dividendStat, 4)
                                .withStat(divisorStat, 0);
                            endBuilder
                                .withStat(dividendStat, 10)
                                .withStat(divisorStat, 5);

                            const history: History = [
                                new PlayerDataBuilder(TEST_UUID, startDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        startBuilder.build(),
                                    )
                                    .build(),
                                new PlayerDataBuilder(TEST_UUID, endDate)
                                    .withGamemodeStats(
                                        gamemode,
                                        endBuilder.build(),
                                    )
                                    .build(),
                            ];

                            const result = computeStatProgression(
                                history,
                                endDate,
                                stat,
                                gamemode,
                            );

                            if (result.error) {
                                assert.fail(
                                    `Expected success but got error: ${result.reason}`,
                                );
                            }

                            assert.deepStrictEqual(result, {
                                stat,
                                endValue: 2,
                                sessionQuotient: 1.2,
                                progressPerDay: 0,
                                dividendPerDay: 0.6,
                                divisorPerDay: 0.5,
                                nextMilestoneValue: 1,
                                daysUntilMilestone: Infinity,
                                trendingUpward: false,
                                trackingDataTimeInterval: {
                                    start: startDate,
                                    end: endDate,
                                },
                            });
                        },
                    );
                });
            }
        });
    }
});

await test("computeStatProgression - stars/experience stat", async (t) => {
    const gamemodes = ALL_GAMEMODE_KEYS;

    // Note: stars+experience are overall stats, but we test it across
    // all gamemodes to verify the API correctly handles
    // overall stats when queried with gamemode-specific keys
    for (const gamemode of gamemodes) {
        await t.test(`gamemode: ${gamemode}`, async (t) => {
            await t.test("basic - steady exp gain", async (t) => {
                const startDate = new Date("2024-01-01T00:00:00Z");
                const endDate = new Date("2024-01-11T00:00:00Z"); // 10 days
                // Start at 500 exp (1 star), gain 5000 exp in 10 days
                const history: History = [
                    new PlayerDataBuilder(TEST_UUID, startDate)
                        .withExperience(500)
                        .build(),
                    new PlayerDataBuilder(TEST_UUID, endDate)
                        .withExperience(7000)
                        .build(),
                ];

                await t.test("stars", () => {
                    const result = computeStatProgression(
                        history,
                        endDate,
                        "stars",
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success but got error: ${result.reason}`,
                        );
                    }

                    const {
                        daysUntilMilestone,
                        progressPerDay,
                        ...resultWithoutTrickyFloats
                    } = result;

                    assert.deepStrictEqual(resultWithoutTrickyFloats, {
                        stat: "stars",
                        endValue: 4,
                        nextMilestoneValue: 100,
                        trendingUpward: true,
                        trackingDataTimeInterval: {
                            start: startDate,
                            end: endDate,
                        },
                    });

                    // (exp gained / avg exp per star) / days
                    const expectedStarsPerDay = 6_500 / 4_870 / 10;
                    assert.ok(
                        Math.abs(progressPerDay - expectedStarsPerDay) < 1e-6,
                    );

                    // Exp remaining until 100 stars / (exp per day)
                    const expectedDaysUntilMilestone =
                        (487_000 - 7_000) / (6_500 / 10);
                    assert.ok(
                        Math.abs(
                            daysUntilMilestone - expectedDaysUntilMilestone,
                        ) < 1e-6,
                    );
                });

                await t.test("experience", () => {
                    const result = computeStatProgression(
                        history,
                        endDate,
                        "experience",
                        gamemode,
                    );

                    if (result.error) {
                        assert.fail(
                            `Expected success but got error: ${result.reason}`,
                        );
                    }

                    assert.deepStrictEqual(result, {
                        stat: "experience",
                        endValue: 7_000,
                        progressPerDay: 650,
                        nextMilestoneValue: 8_000,
                        daysUntilMilestone: 1000 / 650,
                        trendingUpward: true,
                        trackingDataTimeInterval: {
                            start: startDate,
                            end: endDate,
                        },
                    });
                });
            });
        });
    }
});

await test("computeStatProgression - index stat", async (t) => {
    await t.test("success cases", async (t) => {
        // Note: Index = fkdr² * stars
        // We use average exp per star for progression: PRESTIGE_EXP / 100 = 487000 / 100 = 4870

        const cases: {
            name: string;
            explanation: string;
            trackingStats: {
                durationDays: number;
                start: {
                    experience: number;
                    finalKills: number;
                    finalDeaths: number;
                };
                end: {
                    experience: number;
                    finalKills: number;
                    finalDeaths: number;
                };
            };
            expected: {
                index: number;
                milestone: number;
                daysUntilMilestone: number;
                progressPerDay: number;
            };
        }[] = [
            {
                name: "basic - steady progress on all stats",
                explanation: `
Start: exp=500 (1 star), fk=10, fd=5 -> fkdr=2, index=2²*1=4
End: exp=7000 (4 stars), fk=20, fd=10 -> fkdr=2, index=2²*4=16
Duration: 10 days

Progress per day (for milestone calculation):
- Experience: (7000-500)/10 = 650 exp/day
- Using average 4870 exp/star for progression: 650/4870 ≈ 0.1335 stars/day
- Final kills: (20-10)/10 = 1 fk/day
- Final deaths: (10-5)/10 = 0.5 fd/day
- FKDR: constant at 2

To reach milestone 20:
We need to solve: fkdr²(t) * stars(t) = 20
Where (using average exp/star for progression):
- fk(t) = 20 + 1*t
- fd(t) = 10 + 0.5*t
- fkdr(t) = (20+t)/(10+0.5*t)
- exp(t) = 7000 + 650*t
- stars(t) = 4 + 650*t/4870 ≈ 4 + 0.1335*t
- index(t) = [(20+t)/(10+0.5*t)]² * (4+0.1335*t) = 20

At t=10: fk=30, fd=15, fkdr=2, stars≈5.34, index≈2²*5.34≈21.36
Solving numerically: t ≈ 8.8 days

Progress per day: (20-16)/8.8 ≈ 0.455
                `,
                trackingStats: {
                    durationDays: 10,
                    start: {
                        experience: 500,
                        finalKills: 10,
                        finalDeaths: 5,
                    },
                    end: { experience: 7000, finalKills: 20, finalDeaths: 10 },
                },
                expected: {
                    index: 16,
                    milestone: 20,
                    daysUntilMilestone: 8.8,
                    progressPerDay: 0.455,
                },
            },
            {
                name: "zero final deaths at start",
                explanation: `
Start: exp=500 (1 star), fk=10, fd=0 -> fkdr=10, index=10²*1=100
End: exp=7000 (4 stars), fk=20, fd=5 -> fkdr=4, index=4²*4=64
Duration: 10 days

Progress per day (for milestone calculation):
- Experience: 650 exp/day = 650/4870 ≈ 0.1335 stars/day (average)
- Final kills: 1 fk/day
- Final deaths: 0.5 fd/day
- Index decreasing from 100 to 64

Next milestone (going down): 50
At t=0 (end): index=64
Need to find when index(t) = 50
- fk(t) = 20 + 1*t
- fd(t) = 5 + 0.5*t
- stars(t) = 4 + 0.1335*t (using average exp/star)
- index(t) = [(20+t)/(5+0.5*t)]² * (4+0.1335*t) = 50

Since we're trending downward (fkdr declining), 
we won't reach 50. Days until milestone = Infinity (can't reach it going down)
Progress per day = 0
                `,
                trackingStats: {
                    durationDays: 10,
                    start: {
                        experience: 500,
                        finalKills: 10,
                        finalDeaths: 0,
                    },
                    end: { experience: 7000, finalKills: 20, finalDeaths: 5 },
                },
                expected: {
                    index: 64,
                    milestone: 50,
                    daysUntilMilestone: Infinity,
                    progressPerDay: 0,
                },
            },
            {
                name: "zero final deaths overall",
                explanation: `
Start: exp=500 (1 star), fk=5, fd=0 -> fkdr=5, index=5²*1=25
End: exp=7000 (4 stars), fk=10, fd=0 -> fkdr=10, index=10²*4=400
Duration: 10 days

Progress per day (for milestone calculation):
- Experience: 650 exp/day = 650/4870 ≈ 0.1335 stars/day (average)
- Final kills: 0.5 fk/day
- Final deaths: 0 fd/day (no deaths!)
- FKDR = fk (when fd=0)

index(t) = fk(t)² * stars(t) = (10+0.5*t)² * (4+0.1335*t)

Next milestone: 500
(10+0.5*t)² * (4+0.1335*t) = 500

At t=10: fk=15, stars≈5.34, index≈15²*5.34≈1201
Solving the cubic equation numerically: t ≈ 6.1 days

Progress per day: (500-400)/6.1 ≈ 16.39
                `,
                trackingStats: {
                    durationDays: 10,
                    start: { experience: 500, finalKills: 5, finalDeaths: 0 },
                    end: { experience: 7000, finalKills: 10, finalDeaths: 0 },
                },
                expected: {
                    index: 400,
                    milestone: 500,
                    daysUntilMilestone: 6.1,
                    progressPerDay: 16.39,
                },
            },
            {
                name: "no experience progress",
                explanation: `
Start: exp=500 (1 star), fk=10, fd=10 -> fkdr=1, index=1²*1=1
End: exp=500 (1 star), fk=20, fd=10 -> fkdr=2, index=2²*1=4
Duration: 10 days

Progress per day (for milestone calculation):
- Experience: 0 exp/day = 0 stars/day (stars constant at 1)
- Final kills: 1 fk/day
- Final deaths: 0 fd/day
- stars(t) = 1 (constant)

index(t) = fkdr(t)² * 1 = [(20+t)/(10+0*t)]² = [(20+t)/10]²

Next milestone: 5
[(20+t)/10]² = 5
(20+t)/10 = √5 ≈ 2.236
20+t = 22.36
t ≈ 2.36 days

Progress per day: (5-4)/2.36 ≈ 0.424
                `,
                trackingStats: {
                    durationDays: 10,
                    start: {
                        experience: 500,
                        finalKills: 10,
                        finalDeaths: 10,
                    },
                    end: { experience: 500, finalKills: 20, finalDeaths: 10 },
                },
                expected: {
                    index: 4,
                    milestone: 5,
                    daysUntilMilestone: 2.361,
                    progressPerDay: 0.424,
                },
            },
            {
                name: "improving from low index",
                explanation: `
Start: exp=500 (1 star), fk=2, fd=2 -> fkdr=1, index=1²*1=1
End: exp=7000 (4 stars), fk=12, fd=6 -> fkdr=2, index=2²*4=16
Duration: 10 days

Progress per day (for milestone calculation):
- Experience: (7000-500)/10 = 650 exp/day = 650/4870 ≈ 0.1335 stars/day (average)
- Final kills: 1 fk/day
- Final deaths: 0.4 fd/day

Next milestone: 20
index(t) = [(12+1*t)/(6+0.4*t)]² * (4+0.1335*t)

At t=10: fk=22, fd=10, fkdr=2.2, stars≈5.34, index≈2.2²*5.34≈25.8
Solving for index(t) = 20:
t ≈ 7.5 days

Progress per day: (20-16)/7.5 ≈ 0.533
                `,
                trackingStats: {
                    durationDays: 10,
                    start: { experience: 500, finalKills: 2, finalDeaths: 2 },
                    end: { experience: 7000, finalKills: 12, finalDeaths: 6 },
                },
                expected: {
                    index: 16,
                    milestone: 20,
                    daysUntilMilestone: 7.5,
                    progressPerDay: 0.533,
                },
            },
            {
                name: "large values with steady ratios",
                explanation: `
Start: exp=487000 (100 stars), fk=1000, fd=500 -> fkdr=2, index=2²*100=400
End: exp=524000 (110 stars), fk=1100, fd=520 -> fkdr≈2.115, index≈2.115²*110≈492.23
Duration: 20 days

Progress per day (for milestone calculation):
- Experience: (524000-487000)/20 = 1850 exp/day = 1850/4870 ≈ 0.380 stars/day (average)
- Final kills: 5 fk/day
- Final deaths: 1 fd/day

Next milestone: 500
index(t) = [(1100+5*t)/(520+t)]² * (110+0.380*t)

At t=5: fk=1125, fd=525, fkdr≈2.143, stars≈111.9, index≈2.143²*111.9≈514
Solving for t when index(t) = 500:
t ≈ 3.7 days

Progress per day: (500-492.23)/3.7 ≈ 2.1
                `,
                trackingStats: {
                    durationDays: 20,
                    start: {
                        experience: 487000,
                        finalKills: 1000,
                        finalDeaths: 500,
                    },
                    end: {
                        experience: 524000,
                        finalKills: 1100,
                        finalDeaths: 520,
                    },
                },
                expected: {
                    index: 492.23,
                    milestone: 500,
                    daysUntilMilestone: 3.7,
                    progressPerDay: 2.1,
                },
            },
        ];

        for (const c of cases) {
            await t.test(c.name, () => {
                const startDate = new Date("2024-01-01T00:00:00Z");
                const endDate = new Date(
                    startDate.getTime() +
                        c.trackingStats.durationDays * 24 * 60 * 60 * 1000,
                );

                const history: History = [
                    new PlayerDataBuilder(TEST_UUID, startDate)
                        .withExperience(c.trackingStats.start.experience)
                        .withGamemodeStats(
                            "overall",
                            new StatsBuilder()
                                .withStat(
                                    "finalKills",
                                    c.trackingStats.start.finalKills,
                                )
                                .withStat(
                                    "finalDeaths",
                                    c.trackingStats.start.finalDeaths,
                                )
                                .build(),
                        )
                        .build(),
                    new PlayerDataBuilder(TEST_UUID, endDate)
                        .withExperience(c.trackingStats.end.experience)
                        .withGamemodeStats(
                            "overall",
                            new StatsBuilder()
                                .withStat(
                                    "finalKills",
                                    c.trackingStats.end.finalKills,
                                )
                                .withStat(
                                    "finalDeaths",
                                    c.trackingStats.end.finalDeaths,
                                )
                                .build(),
                        )
                        .build(),
                ];

                const result = computeStatProgression(
                    history,
                    endDate,
                    "index",
                    "overall",
                );

                if (result.error) {
                    assert.fail(
                        `Expected success but got error: ${result.reason}`,
                    );
                }

                // Destructure result for float comparisons
                const { daysUntilMilestone, progressPerDay, ...rest } = result;

                // Deep strict equal on exact values
                assert.deepStrictEqual(rest, {
                    stat: "index",
                    endValue: c.expected.index,
                    nextMilestoneValue: c.expected.milestone,
                    trendingUpward: c.expected.milestone >= c.expected.index,
                    trackingDataTimeInterval: {
                        start: startDate,
                        end: endDate,
                    },
                });

                // "Close enough" checks for floats
                assert.ok(
                    Math.abs(
                        daysUntilMilestone - c.expected.daysUntilMilestone,
                    ) < 1e-3,
                    `daysUntilMilestone ${daysUntilMilestone.toString()} should be close to ${c.expected.daysUntilMilestone.toString()}`,
                );
                assert.ok(
                    Math.abs(progressPerDay - c.expected.progressPerDay) < 1e-3,
                    `progressPerDay ${progressPerDay.toString()} should be close to ${c.expected.progressPerDay.toString()}`,
                );
            });
        }
    });
});
