import type { APIPlayerDataPIT } from "#queries/playerdata.ts";
import type { APISession } from "#queries/sessions.ts";

// Anonymized test data based on real API response shapes
// All UUIDs and usernames are fictional

export const TEST_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
export const TEST_USERNAME = "TestPlayer";

export const TEST_UUID_2 = "11111111-2222-3333-4444-555555555555";
export const TEST_USERNAME_2 = "AnotherPlayer";

const makeStats = (overrides: Partial<APIPlayerDataPIT["overall"]> = {}) => ({
    winstreak: null,
    gamesPlayed: 100,
    wins: 70,
    losses: 30,
    bedsBroken: 150,
    bedsLost: 40,
    finalKills: 200,
    finalDeaths: 35,
    kills: 300,
    deaths: 250,
    ...overrides,
});

export const makePlayerDataPIT = (
    overrides: Partial<APIPlayerDataPIT> = {},
): APIPlayerDataPIT => ({
    uuid: TEST_UUID,
    queriedAt: "2025-06-01T00:16:56.025Z",
    experience: 500000,
    solo: makeStats({ gamesPlayed: 20, wins: 12, losses: 8 }),
    doubles: makeStats({ gamesPlayed: 30, wins: 22, losses: 8 }),
    threes: makeStats({ gamesPlayed: 20, wins: 16, losses: 4 }),
    fours: makeStats({ gamesPlayed: 30, wins: 20, losses: 10 }),
    overall: makeStats(),
    ...overrides,
});

export const historyResponse: APIPlayerDataPIT[] = [
    makePlayerDataPIT(),
    makePlayerDataPIT({
        queriedAt: "2025-06-01T20:54:03.892Z",
        experience: 506000,
        doubles: makeStats({
            gamesPlayed: 36,
            wins: 27,
            losses: 9,
            finalKills: 230,
        }),
        fours: makeStats({
            gamesPlayed: 38,
            wins: 26,
            losses: 12,
            finalKills: 225,
        }),
        overall: makeStats({
            gamesPlayed: 114,
            wins: 81,
            losses: 33,
            finalKills: 240,
        }),
    }),
];

export const sessionsResponse: APISession[] = [
    {
        start: makePlayerDataPIT(),
        end: makePlayerDataPIT({
            queriedAt: "2025-06-01T00:37:50.115Z",
            experience: 500800,
            overall: makeStats({
                gamesPlayed: 105,
                wins: 75,
                losses: 30,
                finalKills: 217,
            }),
        }),
        consecutive: true,
    },
    {
        start: makePlayerDataPIT({
            queriedAt: "2025-06-01T16:34:23.286Z",
            experience: 500800,
        }),
        end: makePlayerDataPIT({
            queriedAt: "2025-06-01T17:29:17.895Z",
            experience: 502800,
            overall: makeStats({
                gamesPlayed: 111,
                wins: 78,
                losses: 33,
                finalKills: 225,
            }),
        }),
        consecutive: true,
    },
];

const makeWrappedSession = (): APISession => ({
    start: makePlayerDataPIT({ queriedAt: "2025-06-15T14:00:00.000Z" }),
    end: makePlayerDataPIT({
        queriedAt: "2025-06-15T16:30:00.000Z",
        experience: 506000,
        doubles: makeStats({
            gamesPlayed: 36,
            wins: 27,
            losses: 9,
            finalKills: 230,
        }),
        fours: makeStats({
            gamesPlayed: 38,
            wins: 26,
            losses: 12,
            finalKills: 225,
        }),
        overall: makeStats({
            gamesPlayed: 114,
            wins: 81,
            losses: 33,
            finalKills: 240,
        }),
    }),
    consecutive: true,
});

export const makeWrappedResponse = (
    overrides: Record<string, unknown> = {},
) => ({
    success: true,
    uuid: TEST_UUID,
    year: 2025,
    totalSessions: 100,
    nonConsecutiveSessions: 5,
    yearStats: {
        start: makePlayerDataPIT({
            queriedAt: "2025-01-13T21:09:30.145Z",
            experience: 400000,
        }),
        end: makePlayerDataPIT({
            queriedAt: "2025-12-30T14:13:05.162Z",
            experience: 600000,
            doubles: makeStats({
                gamesPlayed: 36,
                wins: 27,
                losses: 9,
                finalKills: 230,
            }),
            fours: makeStats({
                gamesPlayed: 38,
                wins: 26,
                losses: 12,
                finalKills: 225,
            }),
            overall: makeStats({
                gamesPlayed: 114,
                wins: 81,
                losses: 33,
                finalKills: 240,
            }),
        }),
    },
    sessionStats: {
        sessionLengths: {
            totalHours: 200,
            longestHours: 5.5,
            shortestHours: 0.1,
            averageHours: 1.5,
        },
        sessionsPerMonth: {
            "1": 10,
            "2": 12,
            "3": 8,
            "4": 15,
            "5": 7,
            "6": 11,
            "7": 6,
            "8": 8,
            "9": 9,
            "10": 10,
            "11": 12,
            "12": 7,
        } as Record<string, number>,
        bestSessions: {
            highestFKDR: makeWrappedSession(),
            mostKills: makeWrappedSession(),
            mostFinalKills: makeWrappedSession(),
            mostWins: makeWrappedSession(),
            longestSession: makeWrappedSession(),
            mostWinsPerHour: makeWrappedSession(),
            mostFinalsPerHour: makeWrappedSession(),
        },
        averages: {
            sessionLengthHours: 1.5,
            gamesPlayed: 10,
            wins: 8,
            finalKills: 25,
        },
        winstreaks: {
            overall: { highest: 30, when: "2025-04-30T01:32:03.537Z" },
            solo: { highest: 5, when: "2025-10-30T16:19:29.783Z" },
            doubles: { highest: 15, when: "2025-11-27T00:37:30.957Z" },
            threes: { highest: 20, when: "2025-03-04T00:49:10.035Z" },
            fours: { highest: 40, when: "2025-12-10T04:27:45.706Z" },
        },
        finalKillStreaks: {
            overall: { highest: 80, when: "2025-05-15T12:00:00.000Z" },
            solo: { highest: 15, when: "2025-06-20T14:00:00.000Z" },
            doubles: { highest: 50, when: "2025-07-10T10:00:00.000Z" },
            threes: { highest: 60, when: "2025-08-05T16:00:00.000Z" },
            fours: { highest: 70, when: "2025-09-25T18:00:00.000Z" },
        },
        sessionCoverage: {
            gamesPlayedPercentage: 80,
            adjustedTotalHours: 250,
        },
        flawlessSessions: {
            count: 25,
            percentage: 25,
        },
        playtimeDistribution: {
            hourlyDistribution: [
                5, 6, 4, 3, 2, 1, 0.5, 0.2, 0, 0, 0, 0.1, 0, 0, 0.5, 1, 2, 3,
                4, 5, 6, 7, 6, 5,
            ],
            dayHourDistribution: {
                Monday: Array.from({ length: 24 }, () => 1),
                Tuesday: Array.from({ length: 24 }, () => 1),
                Wednesday: Array.from({ length: 24 }, () => 1),
                Thursday: Array.from({ length: 24 }, () => 1),
                Friday: Array.from({ length: 24 }, () => 1.5),
                Saturday: Array.from({ length: 24 }, () => 2),
                Sunday: Array.from({ length: 24 }, () => 2),
            } as Record<string, number[]>,
        },
    },
    ...overrides,
});

export const wrappedResponse = makeWrappedResponse();
